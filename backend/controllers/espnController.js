'use strict';

/**
 * ESPN API proxy controller.
 *
 * Routes all ESPN external API traffic through the backend so that the
 * browser never calls third-party APIs directly.  The frontend receives
 * already-parsed, structured data and does not need to know about the raw
 * ESPN response shape.
 */

const axios = require('axios');
const dataProvider = require('../models/dataProvider');

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalise a player name for fuzzy comparison:
 * lower-case, strip everything that isn't a letter.
 */
const normName = (n) => (n ?? '').toLowerCase().replace(/[^a-z]/g, '');

// ─── parseMatch ───────────────────────────────────────────────────────────────
// Transforms one raw ESPN event object into the internal match shape consumed
// by the frontend.  Mirrored from frontend/src/hooks/useLiveScores.js so the
// backend can do all parsing and the frontend receives clean, typed data.

const parseMatch = (event) => {
  const comp = event.competitions?.[0];
  if (!comp) return null;

  const home = comp.competitors?.find((c) => c.homeAway === 'home');
  const away = comp.competitors?.find((c) => c.homeAway === 'away');
  const st   = comp.status;

  const details = (comp.details ?? []).map((d) => {
    let icon = 'other';
    if (d.scoringPlay)     icon = 'goal';
    else if (d.redCard)    icon = 'red';
    else if (d.yellowCard) icon = 'yellow';

    return {
      icon,
      minute:       d.clock?.displayValue ?? '',
      teamId:       d.team?.id,
      player:       d.athletesInvolved?.[0]?.shortName ?? d.athletesInvolved?.[0]?.displayName ?? '',
      secondPlayer: d.athletesInvolved?.[1]?.shortName ?? d.athletesInvolved?.[1]?.displayName ?? '',
      penaltyKick:  d.penaltyKick ?? false,
      ownGoal:      d.ownGoal ?? false,
    };
  });

  return {
    espnId:       event.id,
    homeName:     home?.team?.displayName ?? '',
    awayName:     away?.team?.displayName ?? '',
    homeAbbr:     home?.team?.abbreviation ?? '',
    awayAbbr:     away?.team?.abbreviation ?? '',
    homeScore:    parseInt(home?.score ?? '0', 10) || 0,
    awayScore:    parseInt(away?.score ?? '0', 10) || 0,
    homeId:       home?.team?.id,
    awayId:       away?.team?.id,
    state:        st?.type?.state ?? 'pre',  // "pre" | "in" | "post"
    isLive:       st?.type?.state === 'in',
    isFinished:   st?.type?.state === 'post',
    clock:        st?.displayClock ?? '',
    statusDetail: st?.type?.shortDetail ?? '',
    details,
  };
};

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/espn/scoreboard[?dates=YYYYMMDD]
 *
 * Fetches the ESPN PL scoreboard, parses every event through `parseMatch`,
 * and returns the resulting array.  When a `dates` query param is supplied
 * (format YYYYMMDD) the request is scoped to that calendar day; otherwise
 * today's fixtures are returned.
 */
const getScoreboard = async (req, res) => {
  try {
    const { dates } = req.query;

    // Validate dates param format if provided
    if (dates !== undefined && !/^\d{8}$/.test(dates)) {
      return res.status(400).json({ error: 'Invalid dates parameter — expected YYYYMMDD' });
    }

    const url = dates
      ? `${ESPN_BASE}/scoreboard?dates=${dates}`
      : `${ESPN_BASE}/scoreboard`;

    const response = await axios.get(url, { timeout: 10000 });
    const parsed   = (response.data.events ?? []).map(parseMatch).filter(Boolean);
    res.json(parsed);
  } catch (error) {
    console.error('[ESPN] getScoreboard error:', error.message);
    res.status(502).json({ error: 'Failed to fetch ESPN scoreboard' });
  }
};

/**
 * GET /api/espn/summary/:eventId[?fplFixtureId=X&homeAbbr=X&awayAbbr=X]
 *
 * Fetches the ESPN match summary for a completed or in-progress game and
 * returns a structured object containing:
 *   espnAssisters    – traditional assists recorded by ESPN (roster goal-assist
 *                      stats), shaped as [{ name, abbr, value }].
 *   fplOnlyAssisters – assists recorded by FPL but absent from ESPN (e.g.
 *                      winning a penalty).  Computed server-side when the
 *                      optional fplFixtureId, homeAbbr, and awayAbbr query
 *                      params are provided; empty array otherwise.
 *   summaryEventMap  – minute+teamId keyed map of secondary player names from
 *                      key plays, used to attribute assists for penalties/OGs.
 *
 * Optional query params:
 *   fplFixtureId – FPL fixture ID (integer) used to look up FPL assist stats.
 *   homeAbbr     – ESPN abbreviation for the home team (e.g. "LIV").
 *   awayAbbr     – ESPN abbreviation for the away team (e.g. "MCI").
 *
 * When fplFixtureId, homeAbbr, and awayAbbr are all supplied the backend
 * fetches FPL fixture stats, diffs them against the ESPN assister list, and
 * returns the delta as fplOnlyAssisters — moving this reconciliation logic
 * out of the frontend FixturesPanel component.
 */
const getSummary = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { fplFixtureId, homeAbbr, awayAbbr } = req.query;

    // Validate eventId — ESPN event IDs are numeric strings
    if (!eventId || !/^\d+$/.test(eventId)) {
      return res.status(400).json({ error: 'Invalid ESPN event ID' });
    }

    // Validate optional FPL fixture params when any is provided
    const hasFplParams = fplFixtureId !== undefined || homeAbbr !== undefined || awayAbbr !== undefined;
    const validFplParams = hasFplParams
      && /^\d+$/.test(fplFixtureId)
      && /^[A-Za-z0-9]{1,10}$/.test(homeAbbr)
      && /^[A-Za-z0-9]{1,10}$/.test(awayAbbr);

    // If the caller supplied any FPL params but not a complete valid set,
    // return 400 so they get a clear error rather than a silent empty result.
    if (hasFplParams && !validFplParams) {
      return res.status(400).json({
        error: 'When supplying FPL fixture context all three params are required and must be valid: fplFixtureId (integer), homeAbbr (1-10 alphanumeric), awayAbbr (1-10 alphanumeric)',
      });
    }

    const url      = `${ESPN_BASE}/summary?event=${eventId}`;
    const response = await axios.get(url, { timeout: 10000 });
    const data     = response.data;

    // ── Extract espnAssisters from roster stats ──────────────────────────────
    const espnAssisters = [];
    for (const team of data.rosters ?? []) {
      const abbr = team.team?.abbreviation ?? '';
      for (const ath of team.roster ?? []) {
        const gaStat = (ath.stats ?? []).find((s) => s.name === 'goalAssists');
        const gaVal  = parseFloat(gaStat?.value ?? 0);
        if (gaVal > 0) {
          espnAssisters.push({
            name:  ath.athlete?.shortName ?? ath.athlete?.displayName ?? '',
            abbr,
            value: gaVal,
          });
        }
      }
    }

    // ── Build summaryEventMap from key plays ─────────────────────────────────
    // Maps minute+teamId -> secondary player name.  More reliable than the
    // scoreboard's athletesInvolved[1] for penalty kicks and own goals.
    const summaryEventMap = {};
    for (const play of (data.keyPlays ?? data.plays ?? [])) {
      if (!play.scoringPlay) continue;
      const min    = play.clock?.displayValue ?? '';
      const tid    = play.team?.id ?? '';
      const second = play.athletesInvolved?.[1]?.shortName
        ?? play.athletesInvolved?.[1]?.displayName ?? '';
      if (second && min && tid) {
        summaryEventMap[`${min}_${tid}`] = second;
      }
    }

    // ── Compute fplOnlyAssisters when FPL fixture context is supplied ────────
    // FPL records non-traditional assists that ESPN omits (e.g. winning a
    // penalty).  The frontend previously computed this diff; it is now done
    // here so the FixturesPanel component receives the final data directly.
    let fplOnlyAssisters = [];
    if (validFplParams) {
      try {
        const [allFixtures, bootstrap] = await Promise.all([
          dataProvider.fetchFixtures(),
          dataProvider.fetchBootstrapStatic(),
        ]);

        const fixture = allFixtures.find(f => f.id === parseInt(fplFixtureId, 10));
        if (fixture) {
          // Build a quick element-ID → webName lookup
          const elementsById = {};
          (bootstrap.elements || []).forEach(e => { elementsById[e.id] = e.web_name || ''; });

          const assistStat = (fixture.stats ?? []).find(s => s.identifier === 'assists');
          if (assistStat) {
            // Tag home assists with homeAbbr, away assists with awayAbbr
            const fplAssisters = [
              ...(assistStat.h || []).map(e => ({
                name:  elementsById[e.element] || '',
                abbr:  homeAbbr,
                value: e.value,
              })),
              ...(assistStat.a || []).map(e => ({
                name:  elementsById[e.element] || '',
                abbr:  awayAbbr,
                value: e.value,
              })),
            ].filter(a => a.name && a.value > 0);

            // Diff: keep FPL assisters not matched (or under-counted) in ESPN
            for (const fplA of fplAssisters) {
              const espnA = espnAssisters.find(e =>
                e.abbr === fplA.abbr &&
                (normName(e.name).includes(normName(fplA.name)) ||
                  normName(fplA.name).includes(normName(e.name)))
              );
              if (!espnA) {
                fplOnlyAssisters.push({ ...fplA });
              } else if (fplA.value > espnA.value) {
                fplOnlyAssisters.push({ ...fplA, value: fplA.value - espnA.value });
              }
            }
          }
        }
      } catch (fplErr) {
        // Non-fatal: log and return empty fplOnlyAssisters rather than failing the request
        console.warn('[ESPN] getSummary: failed to compute fplOnlyAssisters:', fplErr.message);
      }
    }

    res.json({ espnAssisters, fplOnlyAssisters, summaryEventMap });
  } catch (error) {
    console.error('[ESPN] getSummary error:', error.message);
    res.status(502).json({ error: 'Failed to fetch ESPN summary' });
  }
};

module.exports = { getScoreboard, getSummary };
