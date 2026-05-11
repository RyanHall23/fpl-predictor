'use strict';

/**
 * Backtest engine.
 *
 * Runs the prediction engine against recently completed gameweeks and
 * compares predictions against actual FPL points to derive per-position
 * calibration multipliers.
 *
 * Flow:
 *   1. Identify the last N_BACKTEST_GWS fully-completed gameweeks
 *   2. For each, call computePredictions() in RAW mode (no calibration applied)
 *   3. Fetch the actual player points from event/{gw}/live/
 *   4. Aggregate prediction errors per position (with recency weighting)
 *   5. Hand the aggregate stats to calibrationStore.update()
 *
 * The backtest is intentionally run with the *current* season stats as the
 * player baseline.  This introduces a small forward-looking bias, but:
 *   - The calibration is detecting *systematic positional bias* not individual
 *     player variance — the bias correction is still valid and useful.
 *   - Players whose stats changed significantly in the last 3 GWs benefit
 *     from that change being reflected in the form model anyway.
 *
 * Results are cached for CACHE_TTL_MS to avoid redundant API calls.
 */

const dataProvider    = require('../dataProvider');
const calibrationStore = require('./calibrationStore');

// Imported lazily (via require inside the function) to avoid circular dep
// with predictionEngine which requires this module indirectly.

/** Number of recent completed GWs to include in each backtest run */
const N_BACKTEST_GWS = 3;

/**
 * Minimum actual minutes for a player to be included in calibration.
 * Excluding sub appearances and DNPs keeps the comparison fair.
 */
const MIN_MINUTES = 45;

/**
 * Recency weights for the three tested GWs (most recent first).
 * Must sum to 1.0.
 */
const GW_WEIGHTS = [0.50, 0.35, 0.15];

/** How long to cache a completed backtest run (ms). */
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ── Cache ─────────────────────────────────────────────────────────────────────

let _cacheKey       = null;  // "<gwId>:<players.length>"
let _cacheResult    = null;
let _cacheExpiresAt = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Find the N most recent fully-completed gameweeks before targetGwId.
 *
 * A GW is "fully completed" when every fixture in that event has
 * `finished === true`.
 *
 * @param {Array}  fixtures   - Full fixtures array
 * @param {number} targetGwId - GW we are predicting (excluded from backtest)
 * @param {number} n          - Number of GWs to return
 * @returns {number[]} GW IDs, most recent first
 */
const getRecentCompletedGws = (fixtures, targetGwId, n) => {
  // Group fixtures by event
  const byEvent = {};
  fixtures.forEach((f) => {
    if (f.event == null) return;
    if (!byEvent[f.event]) byEvent[f.event] = [];
    byEvent[f.event].push(f);
  });

  return Object.entries(byEvent)
    .filter(([event, fxs]) => {
      const gwId = Number(event);
      if (gwId >= targetGwId) return false;
      return fxs.every((f) => f.finished === true);
    })
    .map(([event]) => Number(event))
    .sort((a, b) => b - a) // most recent first
    .slice(0, n);
};

/**
 * Fetch actual per-player points for a completed GW.
 * Returns a Map: playerId → { totalPoints, minutes, position }
 *
 * @param {number} gwId
 * @param {Map}    positionMap - Map: playerId → element_type (position)
 * @returns {Promise<Map<number, {totalPoints, minutes, position}>>}
 */
const fetchActualResults = async (gwId, positionMap) => {
  const results = new Map();

  let liveData;
  try {
    liveData = await dataProvider.fetchLiveGameweek(gwId);
  } catch (err) {
    console.warn(`[Backtest] fetchLiveGameweek(${gwId}) failed:`, err.message);
    return results;
  }

  if (!liveData || !Array.isArray(liveData.elements)) return results;

  liveData.elements.forEach((elem) => {
    if (!elem.stats) return;
    results.set(elem.id, {
      totalPoints: elem.stats.total_points ?? 0,
      minutes:     elem.stats.minutes      ?? 0,
      position:    positionMap.get(elem.id) ?? null,
    });
  });

  return results;
};

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Run the full backtest-and-calibrate pipeline.
 *
 * Designed to be called once after the data layer has fetched bootstrap +
 * fixtures.  Subsequent calls within CACHE_TTL_MS return the cached result
 * without re-running.
 *
 * @param {Array}  players      - bootstrap-static players (current season stats)
 * @param {Array}  fixtures     - All fixtures
 * @param {Array}  teams        - bootstrap-static teams
 * @param {number} currentGwId  - GW we are predicting for (excluded from test)
 * @returns {Promise<{gwsTested: number[], summary: Object}>}
 */
const runBacktestAndCalibrate = async (players, fixtures, teams, currentGwId) => {
  // ── Cache check ─────────────────────────────────────────────────────────
  const cacheKey = `${currentGwId}:${players.length}`;
  if (cacheKey === _cacheKey && Date.now() < _cacheExpiresAt && _cacheResult) {
    console.log('[Backtest] Returning cached calibration result.');
    return _cacheResult;
  }

  const gwsToTest = getRecentCompletedGws(fixtures, currentGwId, N_BACKTEST_GWS);

  if (gwsToTest.length === 0) {
    console.log('[Backtest] No completed GWs available — skipping calibration.');
    return { gwsTested: [], summary: {} };
  }

  console.log(`[Backtest] Running against GW(s): ${gwsToTest.join(', ')}`);

  // Build position lookup: playerId → element_type
  // (built from current players; updated per-GW below if a snapshot exists)
  const positionMap = new Map(players.map((p) => [p.id, p.element_type]));

  // Accumulate error stats per position
  const posStats = {
    1: { sumPredicted: 0, sumActual: 0, sumSquaredError: 0, count: 0 },
    2: { sumPredicted: 0, sumActual: 0, sumSquaredError: 0, count: 0 },
    3: { sumPredicted: 0, sumActual: 0, sumSquaredError: 0, count: 0 },
    4: { sumPredicted: 0, sumActual: 0, sumSquaredError: 0, count: 0 },
  };

  // Require lazily to avoid the circular dep chain at module-load time
  const predictionEngine = require('../predictionEngine');

  for (let i = 0; i < gwsToTest.length; i++) {
    const gw     = gwsToTest[i];
    const weight = GW_WEIGHTS[i] ?? 0.10;

    // Use a per-GW player snapshot if one was captured by the daily fetch
    // workflow.  This eliminates the forward-looking bias that arises from
    // using today's stats (form, price, ICT) to predict past GW outcomes.
    // Falls back to the current bootstrap players when no snapshot exists.
    let gwPlayers = players;
    let gwTeams   = teams;
    try {
      const snapshot = await dataProvider.fetchGwPlayerSnapshot(gw);
      if (snapshot && Array.isArray(snapshot.elements) && snapshot.elements.length > 0) {
        gwPlayers = snapshot.elements;
        if (Array.isArray(snapshot.teams) && snapshot.teams.length > 0) {
          gwTeams = snapshot.teams;
        }
        console.log(`[Backtest] GW${gw}: using historical player snapshot (${gwPlayers.length} players).`);
      }
    } catch (_) {
      // Snapshot unavailable — fall through to current stats
    }

    // Run predictions for this GW in RAW mode (calibration disabled)
    const predictions = predictionEngine.computePredictions(
      gwPlayers, fixtures, gwTeams, gw, { skipCalibration: true },
    );

    // Build prediction lookup
    const predMap = new Map(predictions.map((p) => [p.id, p.predicted_points ?? 0]));

    // Fetch actual results — always uses current positionMap for position
    // lookup since positions rarely change and snapshots may not have new players
    const actuals = await fetchActualResults(gw, positionMap);

    let included = 0;

    actuals.forEach((result, playerId) => {
      if (result.minutes < MIN_MINUTES) return;
      const pos  = result.position;
      if (!posStats[pos]) return;

      const predicted = predMap.get(playerId) ?? 0;
      const actual    = result.totalPoints;

      posStats[pos].sumPredicted    += predicted * weight;
      posStats[pos].sumActual       += actual    * weight;
      posStats[pos].sumSquaredError += Math.pow(predicted - actual, 2) * weight;
      posStats[pos].count           += weight;
      included++;
    });

    console.log(`[Backtest] GW${gw}: ${included} qualifying players (weight ${weight})`);
  }

  // Update calibration store from aggregated stats
  calibrationStore.update(posStats, gwsToTest);

  // Build human-readable summary
  const summary = {};
  [1, 2, 3, 4].forEach((pos) => {
    const s = posStats[pos];
    if (s.count < 3) return;
    summary[pos] = {
      multiplier:   calibrationStore.getMultiplier(pos),
      avgPredicted: s.count > 0 ? s.sumPredicted / s.count : 0,
      avgActual:    s.count > 0 ? s.sumActual    / s.count : 0,
      rmse:         s.count > 0 ? Math.sqrt(s.sumSquaredError / s.count) : null,
      n:            Math.round(s.count),
    };
  });

  console.log('[Backtest] Calibration summary:', summary);

  const result = { gwsTested: gwsToTest, summary };

  // Cache the result
  _cacheKey       = cacheKey;
  _cacheResult    = result;
  _cacheExpiresAt = Date.now() + CACHE_TTL_MS;

  return result;
};

/**
 * Expose the helper for unit testing.
 */
const _getRecentCompletedGws = getRecentCompletedGws;

module.exports = {
  runBacktestAndCalibrate,
  _getRecentCompletedGws,
};
