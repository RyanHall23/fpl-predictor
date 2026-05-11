'use strict';

/**
 * Calibration store.
 *
 * Stores prediction-accuracy calibration multipliers derived from backtesting
 * the prediction engine against actual FPL gameweek results.
 *
 * Calibration multiplier per position:
 *
 *   multiplier[pos] = Σ(actual[pos]) / Σ(predicted[pos])
 *
 * A multiplier > 1.0 → the engine is systematically under-predicting for
 * that position.  A multiplier < 1.0 → the engine is over-predicting.
 *
 * Calibration is blended with the previous state (80/20) to avoid jumps
 * between backtesting runs and persisted to disk so subsequent server
 * restarts benefit from prior learning.
 *
 * Thread safety: Node.js is single-threaded so no locking is needed.
 */

const fs   = require('fs');
const path = require('path');

// Path is configurable for deployments where the code directory is read-only.
// Defaults:
// - Vercel/serverless: /tmp/calibration.json
// - Local/dev:         backend/calibration.json
const IS_VERCEL        = Boolean(process.env.VERCEL || process.env.NOW_REGION);
const CALIBRATION_DIR  = process.env.CALIBRATION_DATA_DIR || (IS_VERCEL
  ? '/tmp'
  : path.join(__dirname, '..', '..'));
const CALIBRATION_FILE = process.env.CALIBRATION_FILE_PATH ||
  path.join(CALIBRATION_DIR, 'calibration.json');

// Default calibration (no adjustment) — one multiplier per FPL position (1–4)
// plus sub-position buckets for attacking vs defensive variants.
//
// Sub-position keys: "<pos>_att" for attacking players, "<pos>_def" for defensive.
// A player is classified as "attacking" when their season expected_goals +
// expected_assists > a position-specific threshold.
const DEFAULT_MULTIPLIERS = { 1: 1.0, 2: 1.0, 3: 1.0, 4: 1.0 };
const DEFAULT_SUB_MULTIPLIERS = {
  '2_att': 1.0, '2_def': 1.0,  // attacking vs defensive defenders
  '3_att': 1.0, '3_def': 1.0,  // attacking vs defensive midfielders
};

/**
 * Classify a player into a sub-position key.
 * Returns null for GKs and FWDs (no sub-position split needed).
 */
const subPositionKey = (player) => {
  const pos = player.element_type;
  if (pos === 1 || pos === 4) return null;
  const xg = parseFloat(player.expected_goals  ?? 0) || 0;
  const xa = parseFloat(player.expected_assists ?? 0) || 0;
  const total = xg + xa;
  // Attacking threshold: DEF > 1.5, MID > 3.0 goal+assist contributions per season
  const threshold = pos === 2 ? 1.5 : 3.0;
  return total >= threshold ? `${pos}_att` : `${pos}_def`;
};

/** Blend weight for new calibration data vs existing values */
const BLEND_NEW = 0.80;
const BLEND_OLD = 0.20;

/** Safety clamp: never stray beyond these multipliers regardless of data */
const MULTIPLIER_MIN = 0.50;
const MULTIPLIER_MAX = 1.80;

/** Minimum weighted player-game samples before we trust a position's calibration */
const MIN_SAMPLE_WEIGHT = 5.0;

// ── Module-level state ────────────────────────────────────────────────────────

let _multipliers = { ...DEFAULT_MULTIPLIERS };
let _subMultipliers = { ...DEFAULT_SUB_MULTIPLIERS };
let _meta = {
  updatedAt:   null,
  gwsTested:   [],
  sampleSizes: {},
  rmse:        {},
};

// ── Disk persistence ──────────────────────────────────────────────────────────

/**
 * Load calibration from disk.  Silently falls back to defaults on any error.
 */
const load = () => {
  try {
    if (fs.existsSync(CALIBRATION_FILE)) {
      const raw  = fs.readFileSync(CALIBRATION_FILE, 'utf8');
      const data = JSON.parse(raw);

      _multipliers = {
        ...DEFAULT_MULTIPLIERS,
        1: typeof data[1] === 'number' ? data[1] : 1.0,
        2: typeof data[2] === 'number' ? data[2] : 1.0,
        3: typeof data[3] === 'number' ? data[3] : 1.0,
        4: typeof data[4] === 'number' ? data[4] : 1.0,
      };
      _subMultipliers = {
        ...DEFAULT_SUB_MULTIPLIERS,
        ...Object.fromEntries(
          Object.keys(DEFAULT_SUB_MULTIPLIERS).map((k) => [
            k,
            typeof data.sub?.[k] === 'number' ? data.sub[k] : 1.0,
          ])
        ),
      };
      _meta = data.meta || _meta;

      console.log('[CalibrationStore] Loaded from disk:', _multipliers, 'sub:', _subMultipliers);
    }
  } catch (err) {
    console.warn('[CalibrationStore] Could not load calibration file, using defaults:', err.message);
    _multipliers    = { ...DEFAULT_MULTIPLIERS };
    _subMultipliers = { ...DEFAULT_SUB_MULTIPLIERS };
  }
};

/**
 * Persist calibration state to disk.
 */
const save = () => {
  try {
    const payload = { ..._multipliers, sub: { ..._subMultipliers }, meta: _meta };
    fs.mkdirSync(path.dirname(CALIBRATION_FILE), { recursive: true });
    fs.writeFileSync(CALIBRATION_FILE, JSON.stringify(payload, null, 2));
  } catch (err) {
    console.warn('[CalibrationStore] Could not save calibration:', err.message);
  }
};

// ── Update ────────────────────────────────────────────────────────────────────

/**
 * Update calibration multipliers from a backtesting run.
 *
 * @param {Object} positionStats - Per-position aggregated stats:
 *   { [position]: { sumPredicted, sumActual, sumSquaredError, count } }
 *   May also include sub-position keys like '2_att', '3_def'.
 * @param {number[]} gwsTested - GW IDs that were included in the backtest
 */
const update = (positionStats, gwsTested) => {
  const sampleSizes = {};
  const rmse        = {};

  [1, 2, 3, 4].forEach((pos) => {
    const res = positionStats[pos];

    if (!res || res.count < MIN_SAMPLE_WEIGHT || res.sumPredicted <= 0) {
      // Insufficient data — keep existing multiplier unchanged
      return;
    }

    const rawMultiplier = res.sumActual / res.sumPredicted;
    const clamped       = Math.min(MULTIPLIER_MAX, Math.max(MULTIPLIER_MIN, rawMultiplier));

    // Blend with existing to smooth out single-GW noise
    _multipliers[pos] = BLEND_NEW * clamped + BLEND_OLD * (_multipliers[pos] || 1.0);

    sampleSizes[pos] = Math.round(res.count);
    rmse[pos]        = res.count > 0
      ? Math.sqrt(res.sumSquaredError / res.count)
      : null;
  });

  // Update sub-position multipliers where enough data exists
  Object.keys(DEFAULT_SUB_MULTIPLIERS).forEach((subKey) => {
    const res = positionStats[subKey];
    if (!res || res.count < MIN_SAMPLE_WEIGHT || res.sumPredicted <= 0) return;
    const raw     = res.sumActual / res.sumPredicted;
    const clamped = Math.min(MULTIPLIER_MAX, Math.max(MULTIPLIER_MIN, raw));
    _subMultipliers[subKey] = BLEND_NEW * clamped + BLEND_OLD * (_subMultipliers[subKey] || 1.0);
    sampleSizes[subKey] = Math.round(res.count);
    rmse[subKey]        = res.count > 0 ? Math.sqrt(res.sumSquaredError / res.count) : null;
  });

  _meta = {
    updatedAt:   new Date().toISOString(),
    gwsTested:   gwsTested || [],
    sampleSizes,
    rmse,
  };

  save();

  console.log('[CalibrationStore] Updated multipliers:', _multipliers, 'sub:', _subMultipliers, '| RMSE:', rmse);
};

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Get the calibration multiplier for a position.
 * @param {number} position - FPL element_type (1–4)
 * @returns {number}
 */
const getMultiplier = (position) => _multipliers[position] ?? 1.0;

/**
 * Apply calibration to a raw predicted points value.
 * @param {number} rawPoints - Uncalibrated model output
 * @param {number} position  - FPL element_type (1–4)
 * @returns {number} Calibrated prediction
 */
const applyCalibration = (rawPoints, position) =>
  Math.max(0, rawPoints * getMultiplier(position));

/**
 * Apply the most granular available calibration for a player.
 * Uses the sub-position multiplier when the player has enough data for
 * classification and the sub-position has been sufficiently calibrated;
 * otherwise falls back to the position-level multiplier.
 *
 * @param {number} rawPoints - Uncalibrated model output
 * @param {Object} player    - FPL element (needs element_type, expected_goals, expected_assists)
 * @returns {number} Calibrated prediction
 */
const applyCalibrationForPlayer = (rawPoints, player) => {
  const pos    = player.element_type;
  const subKey = subPositionKey(player);
  if (subKey && _subMultipliers[subKey] != null) {
    // Use sub-position multiplier blended 50/50 with position multiplier
    // to avoid over-fitting when sub-position sample sizes are small.
    const subMult = _subMultipliers[subKey];
    const posMult = _multipliers[pos] ?? 1.0;
    const blended = subMult * 0.60 + posMult * 0.40;
    return Math.max(0, rawPoints * blended);
  }
  return applyCalibration(rawPoints, pos);
};

/**
 * Return the full calibration state (for debugging / API endpoint).
 */
const getState = () => ({
  multipliers: { ..._multipliers },
  meta:        { ..._meta },
});

// Eagerly load persisted calibration when this module is first required
load();

module.exports = {
  load,
  save,
  update,
  getMultiplier,
  applyCalibration,
  applyCalibrationForPlayer,
  subPositionKey,
  getState,
};
