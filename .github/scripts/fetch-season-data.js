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

// Set env vars BEFORE requiring any backend models so dataProvider reads them
// at module-load time and uses the committed seasonData/ files.
process.env.CACHE_STATIC = 'true';
process.env.USE_FPL_API  = 'true';

const API_BASE        = process.env.FPL_API_BASE || 'https://fantasy.premierleague.com/api';
const OUT_DIR         = path.join(__dirname, '..', '..', 'backend', 'seasonData');
const LIVE_DIR        = path.join(OUT_DIR, 'live');
const PLAYERS_DIR     = path.join(OUT_DIR, 'players');
const PREDICTIONS_DIR = path.join(OUT_DIR, 'predictions');

// Ensure output directories exist
fs.mkdirSync(LIVE_DIR, { recursive: true });
fs.mkdirSync(PLAYERS_DIR, { recursive: true });
fs.mkdirSync(PREDICTIONS_DIR, { recursive: true });

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
    const expectedFixtureCount = (fixturesByEvent[gw] || []).length;

    // Skip if already present — but re-fetch if the fixture count has changed
    // (handles rescheduled matches being added to a GW after the file was written).
    if (fs.existsSync(filePath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const coveredFixtures = existing._fixture_count ?? Infinity; // legacy files treated as complete
        if (coveredFixtures >= expectedFixtureCount) {
          process.stdout.write(`  GW${gw}: cached ✓\n`);
          continue;
        }
        process.stdout.write(`  GW${gw}: fixture count changed (${coveredFixtures} → ${expectedFixtureCount}), re-fetching...\n`);
      } catch (_) {
        // Corrupt file — re-fetch
      }
    }

    try {
      await sleep(300); // be polite to the FPL API
      process.stdout.write(`  GW${gw}: fetching...`);
      const live = await fetchJson(`${API_BASE}/event/${gw}/live/`);
      writeJson(filePath, { ...live, _fixture_count: expectedFixtureCount });
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

  // ── 5. Pre-compute predictions for the next/current GW ──────────────────
  // Predictions are only meaningful for a GW that hasn't finished yet.
  // Once a GW concludes its prediction file is stale and will never be served
  // to users, so we skip the expensive computation and delete the old file.
  //
  // Stored at: seasonData/predictions/gw-{n}.json  (overwritten each run
  // while the GW is active; deleted once the GW finishes)
  // Contains:  { gwId, computedAt, players: { [id]: { predicted_points, ... } } }

  // Clean up prediction files for GWs that are now concluded
  if (completedGws.length > 0) {
    for (const gw of completedGws) {
      const stale = path.join(PREDICTIONS_DIR, `gw-${gw}.json`);
      if (fs.existsSync(stale)) {
        fs.unlinkSync(stale);
        console.log(`\nDeleted stale prediction file for concluded GW${gw}.`);
      }
    }
  }

  // Only compute predictions for a GW that is still upcoming / active
  const targetEvent = events.find((ev) => ev.is_next) || events.find((ev) => ev.is_current);
  const targetIsFinished = targetEvent
    ? (targetEvent.finished === true || completedGws.includes(targetEvent.id))
    : true;

  if (targetEvent && !targetIsFinished) {
    try {
      console.log(`\nComputing predictions for GW${targetEvent.id}...`);

      // Lazy-require after env vars are set and all files are written
      const backtestEngine   = require('../../backend/models/prediction/backtestEngine');
      const predictionEngine = require('../../backend/models/predictionEngine');

      const players = bootstrap.elements || [];
      const teams   = bootstrap.teams    || [];

      // Run full backtest calibration against all available completed GWs
      await backtestEngine.runBacktestAndCalibrate(players, fixtures, teams, targetEvent.id);

      // Compute predictions with calibration applied
      const predicted = predictionEngine.computePredictions(players, fixtures, teams, targetEvent.id);

      // Store only the prediction-specific fields keyed by player ID
      const PREDICTION_FIELDS = [
        'ep_next', 'predicted_points', 'expected_goals', 'expected_assists',
        'clean_sheet_probability', 'expected_minutes', 'expected_saves',
        'yellow_card_probability', 'red_card_probability', 'bonus_probability',
        'confidence_score', 'floor_points', 'ceiling_points',
        'fixture_count', 'form_factor', 'calibration_applied',
      ];

      const playerMap = {};
      predicted.forEach((p) => {
        const entry = {};
        PREDICTION_FIELDS.forEach((f) => { if (p[f] !== undefined) entry[f] = p[f]; });
        playerMap[p.id] = entry;
      });

      const predFile = path.join(PREDICTIONS_DIR, `gw-${targetEvent.id}.json`);
      writeJson(predFile, {
        gwId:        targetEvent.id,
        computedAt:  new Date().toISOString(),
        playerCount: predicted.length,
        players:     playerMap,
      });

      console.log(`  → GW${targetEvent.id} predictions written (${predicted.length} players).`);
    } catch (err) {
      console.error(`  Prediction computation failed: ${err.message}`);
      // Non-fatal — live computation will run at request time
    }
  } else if (!targetEvent) {
    console.log('\nNo upcoming GW found — skipping prediction computation.');
  } else {
    console.log(`\nGW${targetEvent.id} already concluded — skipping prediction computation.`);
  }

  // ── 6. Summary ───────────────────────────────────────────────────────────
  const liveFiles       = fs.readdirSync(LIVE_DIR).filter((f) => f.endsWith('.json')).length;
  const playerFiles     = fs.readdirSync(PLAYERS_DIR).filter((f) => f.endsWith('.json')).length;
  const predFiles       = fs.readdirSync(PREDICTIONS_DIR).filter((f) => f.endsWith('.json')).length;
  console.log(`\nDone. Files written:`);
  console.log(`  backend/seasonData/bootstrap-static.json`);
  console.log(`  backend/seasonData/fixtures.json`);
  console.log(`  backend/seasonData/live/        (${liveFiles} GW file(s))`);
  console.log(`  backend/seasonData/players/     (${playerFiles} GW snapshot(s))`);
  console.log(`  backend/seasonData/predictions/ (${predFiles} prediction file(s))`);
})().catch((err) => {
  console.error('\nFetch failed:', err.message);
  process.exit(1);
});
