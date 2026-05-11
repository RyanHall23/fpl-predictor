'use strict';

/**
 * Backtest engine.
 *
 * Runs the prediction engine against recently completed gameweeks and
 * compares predictions against actual FPL points to derive per-position
 * calibration multipliers.
 *
 * Flow:
 *   1. Identify ALL fully-completed gameweeks before the target GW
 *   2. For each, call computePredictions() in RAW mode (no calibration applied)
 *      using the per-GW player snapshot if one was committed by the workflow,
 *      falling back to current bootstrap data for GWs without a snapshot.
 *   3. Fetch the actual player points from event/{gw}/live/
 *   4. Aggregate prediction errors per position using exponential decay weights
 *      so recent GWs dominate but all available history shapes the calibration.
 *   5. Hand the aggregate stats to calibrationStore.update()
 *
 * Using all available GWs (rather than just the last 3) gives the calibration
 * store enough data to detect stable systematic positional biases while the
 * exponential decay ensures the multipliers react quickly to recent trends.
 *
 * Results are cached for CACHE_TTL_MS to avoid redundant API calls.
 */

const dataProvider    = require('../dataProvider');
const calibrationStore = require('./calibrationStore');

/**
 * Minimum actual minutes for a player to be included in calibration.
 * Excluding sub appearances and DNPs keeps the comparison fair.
 */
const MIN_MINUTES = 45;

/**
 * Exponential decay factor for per-GW recency weighting.
 * A value of 0.82 gives the most-recent GW roughly 3× the weight of a GW
 * 6 weeks ago, while still letting older history meaningfully contribute.
 *
 * Weights are normalised to sum to 1.0 across however many GWs are tested,
 * so adding more history never dilutes the total contribution.
 */
const DECAY = 0.82;

/** Compute normalised exponential-decay weights for n GWs (index 0 = most recent). */
const buildGwWeights = (n) => {
  const raw = Array.from({ length: n }, (_, i) => Math.pow(DECAY, i));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => w / sum);
};

/** How long to cache a completed backtest run (ms). */
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ── Cache ─────────────────────────────────────────────────────────────────────

let _cacheKey       = null;  // "<gwId>:<players.length>"
let _cacheResult    = null;
let _cacheExpiresAt = 0;
let _inFlightKey    = null;
let _inFlightRun    = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Find all fully-completed gameweeks before targetGwId.
 *
 * A GW is "fully completed" when every fixture in that event has
 * `finished === true`.
 *
 * @param {Array}  fixtures   - Full fixtures array
 * @param {number} targetGwId - GW we are predicting (excluded from backtest)
 * @returns {number[]} All completed GW IDs before targetGwId, most recent first
 */
const getRecentCompletedGws = (fixtures, targetGwId) => {
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
    .sort((a, b) => b - a); // most recent first
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
  const cacheKey = `${currentGwId}:${players.length}:${fixtures.length}`;
  if (cacheKey === _cacheKey && Date.now() < _cacheExpiresAt && _cacheResult) {
    console.log('[Backtest] Returning cached calibration result.');
    return _cacheResult;
  }

  if (_inFlightRun && _inFlightKey === cacheKey) {
    console.log('[Backtest] Awaiting in-flight calibration run.');
    return _inFlightRun;
  }

  const runPromise = (async () => {
    const gwsToTest = getRecentCompletedGws(fixtures, currentGwId);

    if (gwsToTest.length === 0) {
      console.log('[Backtest] No completed GWs available — skipping calibration.');
      return { gwsTested: [], summary: {} };
    }

    const gwWeights = buildGwWeights(gwsToTest.length);
    console.log(`[Backtest] Running against ${gwsToTest.length} GW(s): ${gwsToTest.join(', ')}`);

    // Build position lookup from current players (positions rarely change, and
    // historical snapshots may not include newly-promoted players).
    const positionMap = new Map(players.map((p) => [p.id, p.element_type]));

    // Accumulate error stats per position and sub-position
    const emptyBucket = () => ({ sumPredicted: 0, sumActual: 0, sumSquaredError: 0, count: 0 });
    const posStats = {
      1: emptyBucket(), 2: emptyBucket(), 3: emptyBucket(), 4: emptyBucket(),
      '2_att': emptyBucket(), '2_def': emptyBucket(),
      '3_att': emptyBucket(), '3_def': emptyBucket(),
    };

    // Require lazily to avoid the circular dep chain at module-load time
    const predictionEngine = require('../predictionEngine');

    for (let i = 0; i < gwsToTest.length; i++) {
      const gw     = gwsToTest[i];
      const weight = gwWeights[i];

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

      // Build per-GW player lookup from the snapshot so sub-position
      // classification uses the same season stats as the predictions, avoiding
      // forward-looking bias when xG/xA totals change later in the season.
      const gwPlayerMap = new Map(gwPlayers.map((p) => [p.id, p]));

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

        // Sub-position accumulation — use gwPlayerMap so classification is
        // based on the historical snapshot stats, not current-season totals.
        const playerObj = gwPlayerMap.get(playerId);
        if (playerObj) {
          const subKey = calibrationStore.subPositionKey(playerObj);
          if (subKey && posStats[subKey]) {
            posStats[subKey].sumPredicted    += predicted * weight;
            posStats[subKey].sumActual       += actual    * weight;
            posStats[subKey].sumSquaredError += Math.pow(predicted - actual, 2) * weight;
            posStats[subKey].count           += weight;
          }
        }

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
  })();

  _inFlightKey = cacheKey;
  _inFlightRun = runPromise;

  try {
    return await runPromise;
  } finally {
    if (_inFlightRun === runPromise) {
      _inFlightKey = null;
      _inFlightRun = null;
    }
  }
};

/**
 * Expose the helper for unit testing.
 */
const _getRecentCompletedGws = getRecentCompletedGws;

module.exports = {
  runBacktestAndCalibrate,
  _getRecentCompletedGws,
};
