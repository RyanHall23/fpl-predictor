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

// On Vercel the filesystem outside /tmp is read-only, so write calibration to
// /tmp when running as a serverless function. Local dev keeps it next to the
// backend root so it survives server restarts.
const IS_VERCEL        = Boolean(process.env.VERCEL || process.env.NOW_REGION);
const CALIBRATION_FILE = IS_VERCEL
  ? path.join('/tmp', 'calibration.json')
  : path.join(__dirname, '..', '..', 'calibration.json');

// Default calibration (no adjustment) — one multiplier per FPL position (1–4)
const DEFAULT_MULTIPLIERS = { 1: 1.0, 2: 1.0, 3: 1.0, 4: 1.0 };

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
      _meta = data.meta || _meta;

      console.log('[CalibrationStore] Loaded from disk:', _multipliers);
    }
  } catch (err) {
    console.warn('[CalibrationStore] Could not load calibration file, using defaults:', err.message);
    _multipliers = { ...DEFAULT_MULTIPLIERS };
  }
};

/**
 * Persist calibration state to disk.
 */
const save = () => {
  try {
    const payload = { ..._multipliers, meta: _meta };
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

  _meta = {
    updatedAt:   new Date().toISOString(),
    gwsTested:   gwsTested || [],
    sampleSizes,
    rmse,
  };

  save();

  console.log('[CalibrationStore] Updated multipliers:', _multipliers, '| RMSE:', rmse);
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
  getState,
};
