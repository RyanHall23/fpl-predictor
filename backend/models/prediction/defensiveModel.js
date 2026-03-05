'use strict';

/**
 * Defensive contribution model.
 *
 * Estimates the probability that a player accumulates enough defensive
 * actions to earn FPL defensive-contribution bonus points.
 *
 * FPL rules (2024/25):
 *   Defender  → 2 pts per 10 defensive actions
 *   Midfielder → 2 pts per 12 defensive actions
 *   Forward    → 2 pts per 12 defensive actions
 *
 * Defensive actions counted: tackles, interceptions, blocks, clearances.
 *
 * P(threshold reached) is computed via the Poisson CDF using position-
 * specific base rates blended with any available per-player data.
 */

const { poissonPMF } = require('./poissonModel');

const num = (v) => {
  if (v == null) return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/** Threshold for earning defensive-action bonus points, by position. */
const POSITION_THRESHOLDS = {
  1: null, // Goalkeeper — not applicable
  2: 10,   // Defender
  3: 12,   // Midfielder
  4: 12,   // Forward
};

/**
 * EPL positional averages for defensive actions per 90 minutes.
 * Derived from typical season-level tackling/interception data.
 */
const POSITION_BASE_RATES = {
  1: 0,   // GK — no threshold, so not computed
  2: 5.8, // Defenders average ~5–7 combined defensive actions per 90
  3: 3.8, // Midfielders average ~3–5
  4: 1.8, // Forwards average ~1–3
};

/**
 * Estimate expected defensive actions per 90 minutes for a player.
 * Blends position baseline with any available season-level data.
 *
 * @param {Object} player - FPL element
 * @returns {number} Expected defensive actions per 90 minutes
 */
const estimateDefensiveActions = (player) => {
  const position  = player.element_type;
  const baseRate  = POSITION_BASE_RATES[position] || 0;

  // FPL bootstrap-static does not carry per-player tackles/interceptions,
  // but some augmented datasets do. Use them when available.
  const tackles       = num(player.tackles       ?? player.tackles_per_90       ?? 0);
  const interceptions = num(player.interceptions ?? player.interceptions_per_90 ?? 0);
  const clearances    = num(player.clearances    ?? player.clearances_per_90    ?? 0);
  const blocks        = num(player.blocks        ?? 0);

  const dataTotal = tackles + interceptions + clearances + blocks;

  if (dataTotal > 0.5) {
    // Blend 70% data-driven + 30% position prior to prevent extremes
    return dataTotal * 0.70 + baseRate * 0.30;
  }

  return baseRate;
};

/**
 * Compute P(player reaches the defensive-action threshold) and the
 * expected number of defensive actions for the fixture.
 *
 * @param {Object} player          - FPL element
 * @param {number} minutesFraction - Fraction of 90 mins expected (0–1)
 * @returns {{ pThreshold: number, expectedDefensiveActions: number }}
 */
const computeDefensiveContribution = (player, minutesFraction = 1) => {
  const position  = player.element_type;
  const threshold = POSITION_THRESHOLDS[position];

  if (!threshold) {
    return { pThreshold: 0, expectedDefensiveActions: 0 };
  }

  const base90Rate       = estimateDefensiveActions(player);
  const expectedActions  = base90Rate * Math.min(1, Math.max(0, minutesFraction));

  if (expectedActions <= 0) {
    return { pThreshold: 0, expectedDefensiveActions: 0 };
  }

  // P(actions >= threshold)
  let cumulativeBelow = 0;
  for (let k = 0; k < threshold; k++) {
    cumulativeBelow += poissonPMF(k, expectedActions);
  }
  const pThreshold = Math.max(0, Math.min(1, 1 - cumulativeBelow));

  return {
    pThreshold,
    expectedDefensiveActions: expectedActions,
  };
};

module.exports = {
  computeDefensiveContribution,
  estimateDefensiveActions,
  POSITION_THRESHOLDS,
  POSITION_BASE_RATES,
};
