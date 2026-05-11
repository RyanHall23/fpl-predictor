#!/usr/bin/env node
'use strict';

/**
 * Fetch FPL static season data and write it to backend/seasonData/.
 *
 * Fetches:
 *   - bootstrap-static (players, teams, events)
 *   - fixtures (all season fixtures with results)
 *   - event/{gw}/live for every completed gameweek
 *
 * User-specific endpoints (entry, picks, history, transfers, leagues) are
 * NOT fetched here — they are always called live at request time.
 *
 * Run via: node .github/scripts/fetch-season-data.js
 * Or automatically by .github/workflows/fetch-season-data.yml
 */

const https   = require('https');
const fs      = require('fs');
const path    = require('path');

const API_BASE     = process.env.FPL_API_BASE || 'https://fantasy.premierleague.com/api';
const OUT_DIR      = path.join(__dirname, '..', '..', 'backend', 'seasonData');
const LIVE_DIR     = path.join(OUT_DIR, 'live');
const PLAYERS_DIR  = path.join(OUT_DIR, 'players');

// Ensure output directories exist
fs.mkdirSync(LIVE_DIR, { recursive: true });
fs.mkdirSync(PLAYERS_DIR, { recursive: true });

// ── HTTP helper ────────────────────────────────────────────────────────────

/**
 * Fetch a URL and return parsed JSON.
 * Includes a User-Agent header — FPL API requires one.
 * Retries once on transient errors.
 *
 * @param {string} url
 * @param {number} [attempt=1]
 * @returns {Promise<any>}
 */
const fetchJson = (url, attempt = 1) =>
  new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'fpl-predictor-season-data-fetcher/1.0',
        'Accept':     'application/json',
      },
    };

    https.get(url, options, (res) => {
      if (res.statusCode === 429 || res.statusCode >= 500) {
        res.resume();
        if (attempt < 3) {
          const delay = attempt * 3000;
          console.warn(`  HTTP ${res.statusCode} from ${url} — retrying in ${delay}ms`);
          return setTimeout(() => fetchJson(url, attempt + 1).then(resolve).catch(reject), delay);
        }
        return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
      }

      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`JSON parse error from ${url}: ${e.message}`));
        }
      });
    }).on('error', (err) => {
      if (attempt < 3) {
        console.warn(`  Network error from ${url} — retrying: ${err.message}`);
        return setTimeout(() => fetchJson(url, attempt + 1).then(resolve).catch(reject), 2000);
      }
      reject(err);
    });
  });

/** Atomically write a JSON file (write to .tmp then rename). */
const writeJson = (filePath, data) => {
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
};

/** Throttle: wait ms milliseconds. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Main ───────────────────────────────────────────────────────────────────

(async () => {
  console.log('=== FPL Season Data Fetcher ===');
  console.log(`API base: ${API_BASE}`);
  console.log(`Output:   ${OUT_DIR}\n`);

  // ── 1. Bootstrap static ──────────────────────────────────────────────────
  console.log('Fetching bootstrap-static...');
  const bootstrap = await fetchJson(`${API_BASE}/bootstrap-static/`);
  writeJson(path.join(OUT_DIR, 'bootstrap-static.json'), bootstrap);
  console.log(`  → ${bootstrap.elements?.length ?? '?'} players, ${bootstrap.teams?.length ?? '?'} teams`);

  // ── 2. Fixtures ──────────────────────────────────────────────────────────
  console.log('Fetching fixtures...');
  const fixtures = await fetchJson(`${API_BASE}/fixtures/`);
  writeJson(path.join(OUT_DIR, 'fixtures.json'), fixtures);
  const finished  = fixtures.filter((f) => f.finished === true).length;
  const remaining = fixtures.length - finished;
  console.log(`  → ${fixtures.length} total fixtures (${finished} finished, ${remaining} remaining)`);

  // ── 3. Completed-GW live scores ──────────────────────────────────────────
  // Determine which GWs are fully finished
  const fixturesByEvent = fixtures.reduce((acc, fixture) => {
    if (fixture.event == null) return acc;
    if (!acc[fixture.event]) acc[fixture.event] = [];
    acc[fixture.event].push(fixture);
    return acc;
  }, {});

  // Cross-reference with events to confirm all fixtures in the GW are done
  const events = (bootstrap.events || []);
  const completedGws = events
    .filter((ev) => {
      if (ev.finished === true) return true;
      const gwFixtures = fixturesByEvent[ev.id] || [];
      return gwFixtures.length > 0 && gwFixtures.every((f) => f.finished === true);
    })
    .map((ev) => ev.id)
    .sort((a, b) => a - b);

  if (completedGws.length === 0) {
    console.log('No completed gameweeks yet — skipping live score fetch.');
  } else {
    console.log(`Fetching live scores for ${completedGws.length} completed GW(s)...`);
  }

  for (const gw of completedGws) {
    const filePath = path.join(LIVE_DIR, `gw-${gw}.json`);

    // Skip if already present — completed GWs don't change
    if (fs.existsSync(filePath)) {
      process.stdout.write(`  GW${gw}: cached ✓\n`);
      continue;
    }

    try {
      await sleep(300); // be polite to the FPL API
      process.stdout.write(`  GW${gw}: fetching...`);
      const live = await fetchJson(`${API_BASE}/event/${gw}/live/`);
      writeJson(filePath, live);
      process.stdout.write(` ${live.elements?.length ?? '?'} elements ✓\n`);
    } catch (err) {
      process.stdout.write(` FAILED: ${err.message}\n`);
      // Don't abort — just skip this GW and continue
    }
  }

  // ── 4. GW player snapshots ───────────────────────────────────────────────
  // Capture a snapshot of all player + team data for the current active GW.
  //
  // Unlike completed-GW live scores (frozen once a GW finishes), player stats
  // (price, form, ICT, xG) keep changing after each GW, so we always overwrite
  // the current GW's snapshot rather than skipping it.
  //
  // We deliberately do NOT backfill past GWs with today's data — that would
  // introduce misleading forward-looking values.  Snapshots accumulate forward
  // as the season progresses.  The backtest engine falls back to current stats
  // for any GW that has no snapshot yet.
  //
  // Snapshot schema: { elements: [...], teams: [...] }
  // Stored at: seasonData/players/gw-{n}.json

  const currentEvent = events.find((ev) => ev.is_current) || events.find((ev) => ev.is_next);
  if (currentEvent) {
    const gwId     = currentEvent.id;
    const filePath = path.join(PLAYERS_DIR, `gw-${gwId}.json`);
    const snapshot = {
      elements: bootstrap.elements || [],
      teams:    bootstrap.teams    || [],
    };
    writeJson(filePath, snapshot);
    console.log(`\nGW${gwId} player snapshot written (${snapshot.elements.length} players).`);
  } else {
    console.log('\nNo current/next event found — skipping player snapshot.');
  }

  // ── 5. Summary ───────────────────────────────────────────────────────────
  const liveFiles    = fs.readdirSync(LIVE_DIR).filter((f) => f.endsWith('.json')).length;
  const playerFiles  = fs.readdirSync(PLAYERS_DIR).filter((f) => f.endsWith('.json')).length;
  console.log(`\nDone. Files written:`);
  console.log(`  backend/seasonData/bootstrap-static.json`);
  console.log(`  backend/seasonData/fixtures.json`);
  console.log(`  backend/seasonData/live/     (${liveFiles} GW file(s))`);
  console.log(`  backend/seasonData/players/  (${playerFiles} GW snapshot(s))`);
})().catch((err) => {
  console.error('\nFetch failed:', err.message);
  process.exit(1);
});
