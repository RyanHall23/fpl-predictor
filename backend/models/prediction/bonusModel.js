'use strict';

/**
 * Bonus Point System (BPS) predictor.
 *
 * Estimates each player's expected BPS score for a fixture and, from that,
 * their probability of finishing in the top-3 BPS earners (which earns
 * FPL bonus points of 3 / 2 / 1).
 *
 * The BPS model mimics the official FPL BPS calculation by estimating
 * the per-player contribution from goals, assists, clean sheets, saves,
 * key passes, shots on target, and defensive actions.
 *
 * Because we don't know exactly how other players will perform, we model
 * bonus probability as a function of how far above the typical BPS
 * the predicted player score is.
 */

const num = (v) => {
  if (v == null) return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Official BPS per-event weights (approximate).
 * Goals scored:
 *   GK/DEF  → 12 BPS
 *   MID     → 18 BPS
 *   FWD     → 24 BPS
 * Assist            → 9 BPS
 * Clean sheet GK/DEF → 12 BPS
 * Save               → 2 BPS each
 * Key pass           → 1 BPS each
 * Shot on target     → 2 BPS each
 * Tackle / clearance → 1 BPS each (approx)
 */
const BPS_GOAL    = { 1: 12, 2: 12, 3: 18, 4: 24 };
const BPS_ASSIST  = 9;
const BPS_CS      = { 1: 12, 2: 12, 3: 0,  4: 0  };
const BPS_SAVE    = 2;
const BPS_KEY_PASS     = 1;
const BPS_SOT          = 2;
const BPS_DEF_ACTION   = 0.8; // per action (tackle/interception/clearance)

/**
 * Typical EPL "base" BPS for a player who just appears (showing up ≈ 3 BPS).
 * Players below this struggle to earn bonus.
 */
const BPS_APPEARANCE_BASE = 3;

/**
 * Estimate expected BPS for a player from their predicted contributions.
 *
 * @param {Object} player  - FPL element
 * @param {Object} contrib - Contribution estimates from other models:
 *   expectedGoals, expectedAssists, cleanSheetProb,
 *   expectedSaves, expectedDefensiveActions, minutesFraction
 * @returns {{
 *   expectedBPS:    number,
 *   pBonus:         number,
 *   expectedBonus:  number
 * }}
 */
const estimateBPS = (player, contrib) => {
  const {
    expectedGoals         = 0,
    expectedAssists       = 0,
    cleanSheetProb        = 0,
    expectedSaves         = 0,
    expectedDefensiveActions = 0,
    minutesFraction       = 1,
  } = contrib;

  const position = player.element_type;
  const mf = Math.min(1, Math.max(0, minutesFraction));

  // ── Goal and assist BPS ──────────────────────────────────────────────────
  const goalBPS   = (BPS_GOAL[position]  || 18) * expectedGoals;
  const assistBPS = BPS_ASSIST * expectedAssists;

  // ── Clean-sheet BPS ──────────────────────────────────────────────────────
  const csBPS = (BPS_CS[position] || 0) * cleanSheetProb;

  // ── Save BPS (GK only) ───────────────────────────────────────────────────
  const saveBPS = position === 1 ? BPS_SAVE * expectedSaves : 0;

  // ── Attacking-action BPS (key passes, shots on target) ───────────────────
  // Estimate from expected goals/assists proportionally
  const keyPasses     = expectedAssists * 2.5;   // ~2–3 key passes per expected assist
  const shotsOnTarget = expectedGoals   * 3.0;   // ~3 SoT per expected goal
  const attackActBPS  = (keyPasses * BPS_KEY_PASS + shotsOnTarget * BPS_SOT) * mf;

  // ── Defensive-action BPS ─────────────────────────────────────────────────
  const defBPS = expectedDefensiveActions * BPS_DEF_ACTION;

  // ── Appearance base ──────────────────────────────────────────────────────
  const appearanceBPS = BPS_APPEARANCE_BASE * mf;

  const expectedBPS =
    goalBPS + assistBPS + csBPS + saveBPS + attackActBPS + defBPS + appearanceBPS;

  // ── Bonus probability ────────────────────────────────────────────────────
  // Logistic (sigmoid) mapping from BPS to P(finishing top-3 BPS earners).
  // Calibration: a player with BPS ≈ 28 (typical mid-field baseline for a
  // player with a goal involvement) has ~50% probability of receiving bonus;
  // a player with BPS ≈ 55 (goal + assist + CS) has ~90% probability.
  // The scale factor 12 governs the steepness of the transition.
  const pBonus = 1 / (1 + Math.exp(-(expectedBPS - 28) / 12));

  // ── Expected bonus points ────────────────────────────────────────────────
  // Approximates expected value across top-3 finishes weighted roughly:
  //   rank-1 (~40%): 3 pts, rank-2 (~35%): 2 pts, rank-3 (~25%): 1 pt
  // → E[bonus | top-3] ≈ 2.15, and P(top-3) ≈ pBonus, so:
  //   E[bonus] ≈ pBonus × 1.6 (conservative blend to avoid over-predicting bonus)
  const expectedBonus = Math.min(3, pBonus * 1.6);

  return {
    expectedBPS:   Math.max(0, expectedBPS),
    pBonus:        Math.min(1, Math.max(0, pBonus)),
    expectedBonus: Math.max(0, expectedBonus),
  };
};

module.exports = {
  estimateBPS,
  BPS_GOAL,
  BPS_ASSIST,
  BPS_CS,
};
