'use strict';

/**
 * Calibration Engine
 *
 * Compares predicted vs actual FPL points using historical per-GW data
 * from element-summary endpoints. For each sampled player, historical
 * game entries carry per-GW xG, xA, actual events and total_points —
 * enough to reconstruct what the engine would have predicted and
 * compare it to what actually happened.
 *
 * Two complementary analyses are run:
 *
 *   1. Deterministic reconstruction
 *      Apply the official FPL scoring rules to actual events (goals,
 *      assists, minutes, saves…). The gap vs total_points reveals
 *      unmodelled events such as own goals, penalty misses/saves.
 *
 *   2. xG-based engine simulation
 *      Feed each game's actual xG/xA through the fplScorer — the same
 *      path the live engine takes. The gap vs total_points measures the
 *      inherent xG→goals variance plus any systematic scorer bias.
 *
 * From these comparisons the engine derives:
 *   • MAE and RMSE (accuracy)
 *   • Bias (systematic over/under-prediction)
 *   • Per-position and per-scoring-component breakdowns
 *   • Calibration scale factors that are applied to future predictions
 *
 * Pipeline:
 *   runCalibration()           → metrics + weights (no new predictions)
 *   runCalibratedPredictions() → metrics + weights + prediction output
 */

const fplScorer        = require('../prediction/fplScorer');
const predictionEngine = require('../predictionEngine');

const { GK, DEF, GOAL_POINTS, CLEAN_SHEET_POINTS } = fplScorer;

const POSITION_NAMES = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };

const num = (v) => {
  if (v == null) return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (v) => Math.round(v * 100) / 100;

// ─── Module-level calibration state (in-memory singleton) ─────────────────────

let _calibrationState = null;

/** Return the most recently computed calibration weights, or null. */
const getCalibrationState = () => _calibrationState;

/** Overwrite the stored calibration weights. */
const setCalibrationState = (state) => {
  _calibrationState = state;
};

// ─── 1. Deterministic FPL scoring reconstruction ──────────────────────────────

/**
 * Apply the official FPL scoring rules to a historical game entry.
 *
 * This produces an exact rule-based score. When compared to total_points
 * the residual reveals events not tracked in bootstrap-static history:
 * own goals (−2 each), penalty misses (−2), penalty saves (+5).
 *
 * @param {Object} h        - element-summary history entry
 * @param {number} position - FPL element_type (1 GK … 4 FWD)
 * @returns {Object} Itemised score breakdown
 */
const deterministicScore = (h, position) => {
  const minutes      = num(h.minutes);
  const goals        = num(h.goals_scored);
  const assists      = num(h.assists);
  const cleanSheets  = num(h.clean_sheets);
  const saves        = num(h.saves);
  const yellowCards  = num(h.yellow_cards);
  const redCards     = num(h.red_cards);
  const goalsConceded = num(h.goals_conceded);
  const bonus        = num(h.bonus);

  const played     = minutes > 0;
  const played60   = minutes >= 60;

  const playingTimePoints   = played60 ? 2 : (played ? 1 : 0);
  const goalPoints          = (GOAL_POINTS[position] || 5) * goals;
  const assistPoints        = 3 * assists;
  const csPoints            = played60 ? ((CLEAN_SHEET_POINTS[position] || 0) * cleanSheets) : 0;
  const savePoints          = position === GK ? Math.floor(saves / 3) : 0;
  const yellowPoints        = -(yellowCards);
  const redPoints           = -(redCards * 3);
  // FPL: −1 per 2 goals conceded, only for GK and DEF
  const goalsConcededPoints = (position === GK || position === DEF)
    ? -(Math.floor(goalsConceded / 2))
    : 0;

  const total = playingTimePoints + goalPoints + assistPoints + csPoints +
    savePoints + yellowPoints + redPoints + goalsConcededPoints + bonus;

  return {
    total,
    playingTimePoints,
    goalPoints,
    assistPoints,
    csPoints,
    savePoints,
    bonusPoints:          bonus,
    disciplinePoints:     yellowPoints + redPoints,
    goalsConcededPoints,
  };
};

// ─── 2. xG-based engine simulation ────────────────────────────────────────────

/**
 * Simulate what the prediction engine would output for a historical GW entry
 * using the game's actual per-match xG/xA as the "expected" values.
 *
 * Non-goal components (saves, CS, cards, bonus) use the actual realised
 * values so we isolate xG→goals as the variance source.
 *
 * @param {Object} h        - element-summary history entry
 * @param {number} position - FPL element_type
 * @returns {Object} fplScorer output
 */
const xgBasedPrediction = (h, position) => {
  const minutes       = num(h.minutes);
  const xG            = num(h.expected_goals);
  const xA            = num(h.expected_assists);
  const minutesFrac   = Math.min(1, minutes / 90);
  const played        = minutes > 0;
  const played60      = minutes >= 60;
  const starts        = num(h.starts);
  const pPlay         = played ? 1 : 0;
  const cleanSheets   = num(h.clean_sheets);
  const saves         = num(h.saves);
  const yellowCards   = num(h.yellow_cards);
  const redCards      = num(h.red_cards);
  const goalsConceded = num(h.goals_conceded);
  const bonus         = num(h.bonus);

  const pStart          = starts > 0 ? 1 : 0;
  const pSubAppearance  = played && starts === 0 ? 1 : 0;
  // p60Plus is fractional so the scorer produces fractional minute-pts that match
  // long-run averages (same convention used in the live prediction engine).
  const p60PlusVal      = played60 ? minutesFrac : 0;

  return fplScorer.computeExpectedFPLPoints(
    { element_type: position },
    {
      pStart,
      pSubAppearance,
      p60Plus:            p60PlusVal,
      // expectedGoals/Assists already pre-scaled by pPlay upstream in engine
      expectedGoals:      xG * pPlay,
      expectedAssists:    xA * pPlay,
      cleanSheetProb:     cleanSheets > 0 ? 1 : 0,
      expectedSavePoints: position === GK ? Math.floor(saves / 3) : 0,
      pYellowCard:        yellowCards > 0 ? minutesFrac : 0,
      pRedCard:           redCards    > 0 ? minutesFrac : 0,
      pDefensiveBonus:    0,    // not available in history → adds downward bias for DEF/MID
      expectedBonus:      bonus,
      goalsConcededLambda: goalsConceded,
    },
  );
};

// ─── 3. Per-player historical pair builder ────────────────────────────────────

/**
 * Build calibration observation records from a player's element-summary history.
 * Only entries where the player appeared (minutes > 0) are used.
 *
 * Each record pairs the engine's retroactive prediction against the actual points
 * for that gameweek, plus itemised component values for bias analysis.
 *
 * @param {Object} player    - FPL element (needs id, element_type)
 * @param {Array}  history   - element-summary history array
 * @param {number} [maxGWs=10] - How many most-recent gameweeks to include
 * @returns {Array} Calibration pair records
 */
const buildPlayerPairs = (player, history, maxGWs = 10) => {
  if (!Array.isArray(history) || history.length === 0) return [];

  const position = player.element_type;
  if (!position) return [];

  const playedEntries = history
    .filter(h => num(h.minutes) > 0)
    .sort((a, b) => num(a.round) - num(b.round));

  // Take the most recent maxGWs entries
  const entries = playedEntries.slice(-Math.abs(maxGWs));

  return entries.map((h) => {
    const determ  = deterministicScore(h, position);
    const xgPred  = xgBasedPrediction(h, position);
    const actual  = num(h.total_points);

    return {
      playerId:                 player.id || num(h.element),
      position,
      positionName:             POSITION_NAMES[position] || 'UNK',
      round:                    num(h.round),
      actual,
      deterministicPredicted:   round2(determ.total),
      xgPredicted:              round2(xgPred.total),

      // Per-component actual values (deterministic rules applied to events)
      actualComponents: {
        playingTime:  determ.playingTimePoints,
        goals:        determ.goalPoints,
        assists:      determ.assistPoints,
        cleanSheet:   determ.csPoints,
        saves:        determ.savePoints,
        discipline:   determ.disciplinePoints,
        goalsConceded: determ.goalsConcededPoints,
        bonus:        determ.bonusPoints,
      },

      // Per-component xG-based predicted values
      predictedComponents: {
        playingTime:  round2(xgPred.playingTimePoints),
        goals:        round2(xgPred.goalPoints),
        assists:      round2(xgPred.assistPoints),
        cleanSheet:   round2(xgPred.csPoints),
        saves:        round2(xgPred.savePoints),
        discipline:   round2(xgPred.disciplinePoints),
        goalsConceded: round2(xgPred.goalsConcededPoints),
        bonus:        round2(xgPred.bonusPoints),
      },

      // Signed errors: positive = engine over-predicted
      deterministicError: round2(determ.total  - actual),
      xgError:            round2(xgPred.total  - actual),
    };
  });
};

// ─── 4. Error metrics computation ─────────────────────────────────────────────

const _mean = (arr) => arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;

const _mae  = (errs) => _mean(errs.map(Math.abs));
const _bias = (errs) => _mean(errs);
const _rmse = (errs) => Math.sqrt(_mean(errs.map(e => e * e)));

const _correlation = (predicted, actual) => {
  const mP  = _mean(predicted);
  const mA  = _mean(actual);
  const cov = _mean(predicted.map((p, i) => (p - mP) * (actual[i] - mA)));
  const sdP = Math.sqrt(_mean(predicted.map(p => (p - mP) ** 2)));
  const sdA = Math.sqrt(_mean(actual.map(a  => (a - mA) ** 2)));
  if (sdP === 0 || sdA === 0) return 0;
  return round2(cov / (sdP * sdA));
};

/**
 * Compute calibration metrics from all collected observation pairs.
 *
 * @param {Array} pairs - Output of buildPlayerPairs() across multiple players
 * @returns {Object}    - Metrics report (overall, by position, by component)
 */
const computeMetrics = (pairs) => {
  if (pairs.length === 0) {
    return { error: 'No calibration pairs available' };
  }

  const actuals      = pairs.map(p => p.actual);
  const xgPreds      = pairs.map(p => p.xgPredicted);
  const detErrs      = pairs.map(p => p.deterministicError);
  const xgErrs       = pairs.map(p => p.xgError);

  // ── Overall metrics ───────────────────────────────────────────────────────
  const overall = {
    sampleSize:               pairs.length,
    actualMeanPerGame:        round2(_mean(actuals)),
    deterministic: {
      mae:    round2(_mae(detErrs)),
      bias:   round2(_bias(detErrs)),
      rmse:   round2(_rmse(detErrs)),
      note:   'Gap from actual = unmodelled events (own goals, penalty misses/saves)',
    },
    xgBased: {
      mae:         round2(_mae(xgErrs)),
      bias:        round2(_bias(xgErrs)),
      rmse:        round2(_rmse(xgErrs)),
      correlation: _correlation(xgPreds, actuals),
      note:        'Residual = inherent xG→goals variance + scorer bias',
    },
  };

  // ── Per-position breakdown ────────────────────────────────────────────────
  const byPosition = {};
  [1, 2, 3, 4].forEach((pos) => {
    const posName  = POSITION_NAMES[pos];
    const posPairs = pairs.filter(p => p.position === pos);
    if (posPairs.length === 0) return;
    byPosition[posName] = {
      n:          posPairs.length,
      actualMean: round2(_mean(posPairs.map(p => p.actual))),
      xgBased: {
        mae:  round2(_mae(posPairs.map(p => p.xgError))),
        bias: round2(_bias(posPairs.map(p => p.xgError))),
      },
      deterministic: {
        mae:  round2(_mae(posPairs.map(p => p.deterministicError))),
        bias: round2(_bias(posPairs.map(p => p.deterministicError))),
      },
    };
  });

  // ── Per-component mean comparison ─────────────────────────────────────────
  const componentKeys = ['playingTime', 'goals', 'assists', 'cleanSheet', 'saves', 'discipline', 'bonus'];
  const componentAnalysis = {};
  componentKeys.forEach((key) => {
    const actVals  = pairs.map(p => p.actualComponents[key]     || 0);
    const predVals = pairs.map(p => p.predictedComponents[key]  || 0);
    const actMean  = round2(_mean(actVals));
    const predMean = round2(_mean(predVals));
    componentAnalysis[key] = {
      actualMean:    actMean,
      predictedMean: predMean,
      // positive = over-prediction
      meanGap:       round2(predMean - actMean),
    };
  });

  return { ...overall, byPosition, componentAnalysis };
};

// ─── 5. Calibration weight derivation ─────────────────────────────────────────

/**
 * Derive calibration multipliers from error metrics.
 *
 * For each scoring component the scale factor is:
 *   scale = mean(actual) / mean(predicted)
 * clamped to [0.60, 1.60] to prevent wild over-correction on small samples.
 *
 * The overall scale corrects for the xG-based signed bias:
 *   overallScale = actualMean / predictedMean
 *
 * @param {Object} metrics - Output of computeMetrics()
 * @returns {Object} Calibration weights
 */
const deriveCalibrationWeights = (metrics) => {
  const clamp = (v, lo = 0.60, hi = 1.60) => Math.min(hi, Math.max(lo, v));
  const safeScale = (actual, predicted) => {
    if (!predicted || Math.abs(predicted) < 0.005) return 1.0;
    return clamp(actual / predicted);
  };

  const ca   = metrics.componentAnalysis || {};
  const xgB  = metrics.xgBased           || {};
  const bias = xgB.bias || 0;
  const actualMean    = metrics.actualMeanPerGame  || 1;
  const predictedMean = actualMean + bias;            // xgBased.bias = predicted - actual

  const overallScale  = safeScale(actualMean, predictedMean);

  // Component-level scales
  const goalScale   = safeScale(ca.goals?.actualMean,       ca.goals?.predictedMean);
  const assistScale = safeScale(ca.assists?.actualMean,     ca.assists?.predictedMean);
  const csScale     = safeScale(ca.cleanSheet?.actualMean,  ca.cleanSheet?.predictedMean);
  const bonusScale  = safeScale(ca.bonus?.actualMean,       ca.bonus?.predictedMean);
  const saveScale   = safeScale(ca.saves?.actualMean,       ca.saves?.predictedMean);

  const absB = Math.abs(bias);
  const biasCategory =
    absB < 0.20 ? 'well-calibrated' :
    bias > 0    ? 'over-predicting'  : 'under-predicting';

  const biasStrength =
    absB < 0.20 ? 'negligible'  :
    absB < 0.50 ? 'slight'      :
    absB < 1.00 ? 'moderate'    : 'severe';

  return {
    overallScale,
    goalScale,
    assistScale,
    csScale,
    bonusScale,
    saveScale,
    biasCategory,
    biasStrength,
    rawBias:    round2(bias),
    sampleSize: metrics.sampleSize || 0,
    appliedAt:  new Date().toISOString(),
  };
};

// ─── 6. Apply calibration to predictions ──────────────────────────────────────

/**
 * Scale predicted_points, floor_points and ceiling_points by the overall
 * calibration factor.  ep_next is updated to match predicted_points.
 *
 * The per-component scales (goalScale, bonusScale…) are stored in the weights
 * object for transparency and future per-component application, but the current
 * implementation uses the simpler overall scale to avoid compounding errors
 * across multiple multiplied adjustments.
 *
 * @param {Array}  players     - Players with predicted_points set by the engine
 * @param {Object} calibration - Output of deriveCalibrationWeights()
 * @returns {Array}            - Shallow-cloned array with adjusted point fields
 */
const applyCalibration = (players, calibration) => {
  if (!calibration || !Number.isFinite(calibration.overallScale)) return players;

  const scale = calibration.overallScale;
  // Skip if the adjustment is negligible (< 0.5%)
  if (Math.abs(scale - 1.0) < 0.005) return players;

  const r = (v) => Math.max(0, round2(v));

  return players.map((p) => {
    if (!p.predicted_points) return p;
    const scaled = p.predicted_points * scale;
    return {
      ...p,
      predicted_points:    r(scaled),
      floor_points:        r((p.floor_points    || 0) * scale),
      ceiling_points:      r((p.ceiling_points  || 0) * scale),
      ep_next:             r(scaled),
      calibration_applied: true,
      calibration_scale:   round2(scale),
    };
  });
};

// ─── 7. Human-readable report builder ─────────────────────────────────────────

const _generateReport = (metrics, weights, pairCount) => {
  const { xgBased, deterministic, byPosition = {}, componentAnalysis = {} } = metrics;
  const bias = xgBased?.bias || 0;

  // Component insight lines where the gap is non-trivial (> 0.05 pts/game)
  const componentInsights = Object.entries(componentAnalysis)
    .filter(([, v]) => Math.abs(v.meanGap || 0) > 0.05)
    .map(([key, v]) =>
      `${key}: predicted avg ${v.predictedMean} vs actual avg ${v.actualMean}` +
      ` (gap: ${v.meanGap >= 0 ? '+' : ''}${v.meanGap} pts/game)`,
    );

  const biasExplanation =
    Math.abs(bias) < 0.10
      ? 'Engine is well-calibrated — no significant bias detected.'
      : bias > 0
        ? `Engine over-predicts by ${round2(Math.abs(bias))} pts/game on average. Scale ×${weights.overallScale} applied.`
        : `Engine under-predicts by ${round2(Math.abs(bias))} pts/game on average. Scale ×${weights.overallScale} applied.`;

  const positionRows = Object.entries(byPosition).map(([pos, d]) => ({
    position:       pos,
    observations:   d.n,
    actualMean:     d.actualMean,
    xgBias:         d.xgBased?.bias,
    xgMAE:          d.xgBased?.mae,
    detBias:        d.deterministic?.bias,
  }));

  return {
    summary: [
      `Analysed ${pairCount} player-gameweek observations.`,
      `xG-based MAE: ${xgBased?.mae} pts/game | Bias: ${round2(bias)} pts (${weights.biasCategory}, ${weights.biasStrength}).`,
      `Deterministic rule MAE: ${deterministic?.mae} pts/game (residual = own goals / penalty events).`,
      `Overall calibration scale applied: ×${weights.overallScale}.`,
    ].join(' '),
    biasAnalysis: {
      category:    weights.biasCategory,
      strength:    weights.biasStrength,
      rawBias:     round2(bias),
      explanation: biasExplanation,
    },
    componentInsights,
    positionBreakdown: positionRows,
    appliedAdjustments: {
      overallScale: weights.overallScale,
      goalScale:    weights.goalScale,
      assistScale:  weights.assistScale,
      csScale:      weights.csScale,
      bonusScale:   weights.bonusScale,
      saveScale:    weights.saveScale,
    },
  };
};

// ─── 8. Public pipeline functions ──────────────────────────────────────────────

/**
 * Run the full calibration pipeline against historical element-summary data.
 *
 * Does NOT generate new predictions — call runCalibratedPredictions() for that.
 *
 * @param {Array}  players           - Full FPL elements array (bootstrap-static)
 * @param {Object} elementSummaryMap - Plain object: playerId (string/number) → element-summary
 * @param {Object} [options]
 * @param {number} [options.maxGWsPerPlayer=10] - Most-recent GWs per player
 * @returns {{ pairs, metrics, weights, report }}
 */
const runCalibration = (players, elementSummaryMap, options = {}) => {
  const { maxGWsPerPlayer = 10 } = options;

  // Index players by id for fast lookup
  const playerById = {};
  players.forEach((p) => { playerById[p.id] = p; });

  // Build all observation pairs
  const allPairs = [];
  for (const [playerIdStr, summaryData] of Object.entries(elementSummaryMap)) {
    const playerId = parseInt(playerIdStr, 10);
    const player   = playerById[playerId];
    if (!player) continue;
    const history  = summaryData?.history || [];
    allPairs.push(...buildPlayerPairs(player, history, maxGWsPerPlayer));
  }

  if (allPairs.length === 0) {
    const emptyWeights = {
      overallScale: 1.0,
      goalScale: 1.0, assistScale: 1.0, csScale: 1.0,
      bonusScale: 1.0, saveScale: 1.0,
      biasCategory: 'unknown', biasStrength: 'unknown',
      rawBias: 0, sampleSize: 0,
      appliedAt: new Date().toISOString(),
    };
    return {
      pairs:   [],
      metrics: { error: 'No historical GW data available for any sampled player' },
      weights: emptyWeights,
      report:  { summary: 'Calibration skipped — no historical data returned by element-summary API.' },
    };
  }

  const metrics = computeMetrics(allPairs);
  const weights = deriveCalibrationWeights(metrics);

  // Persist in module-level singleton so applyCalibration() can be called later
  setCalibrationState(weights);

  const report = _generateReport(metrics, weights, allPairs.length);

  return { pairs: allPairs, metrics, weights, report };
};

/**
 * Run calibration then generate calibrated predictions for a target gameweek.
 *
 * @param {Array}  players           - FPL elements
 * @param {Array}  fixtures          - FPL fixtures
 * @param {Array}  teams             - FPL teams
 * @param {Object} elementSummaryMap - playerId → element-summary
 * @param {number} targetGW          - Gameweek to predict
 * @param {Object} [options]         - Passed through to runCalibration()
 * @returns {{ players, calibration, metrics, report }}
 */
const runCalibratedPredictions = (players, fixtures, teams, elementSummaryMap, targetGW, options = {}) => {
  const { metrics, weights, report } = runCalibration(players, elementSummaryMap, options);

  const rawPredictions       = predictionEngine.computePredictions(players, fixtures, teams, targetGW);
  const calibratedPlayers    = applyCalibration(rawPredictions, weights);

  return {
    players:     calibratedPlayers,
    calibration: weights,
    metrics,
    report,
  };
};

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  // Main pipeline
  runCalibration,
  runCalibratedPredictions,
  // Lower-level utilities
  buildPlayerPairs,
  computeMetrics,
  deriveCalibrationWeights,
  applyCalibration,
  deterministicScore,
  xgBasedPrediction,
  // State management
  getCalibrationState,
  setCalibrationState,
};
