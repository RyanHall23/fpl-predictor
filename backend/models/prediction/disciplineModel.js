'use strict';

/**
 * Discipline model.
 *
 * Estimates the per-game probability of a player receiving a yellow card
 * or red card, and the corresponding expected negative FPL points.
 *
 * FPL scoring:
 *   Yellow card → −1 point
 *   Red card    → −3 points (player also leaves the pitch)
 *
 * Method:
 *   1. Use position-level base rates derived from EPL data.
 *   2. Blend with the player's own historical card rate (if minutes > 0).
 *   3. Exposure-weight so players who play fewer minutes get proportionally
 *      fewer cards.
 */

const num = (v) => {
  if (v == null) return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * EPL per-game yellow-card rates by outfield position.
 * Derived from typical season averages (roughly 1 yellow per 15 games for mids).
 */
const POSITION_YELLOW_RATE = {
  1: 0.022, // GK
  2: 0.055, // DEF
  3: 0.068, // MID
  4: 0.050, // FWD
};

/** Per-game red-card rate (all positions, rare event). */
const BASE_RED_CARD_RATE = 0.005;

/**
 * Compute discipline risk for a player.
 *
 * @param {Object} player          - FPL element from bootstrap-static
 * @param {number} minutesFraction - Fraction of 90 mins expected this fixture (0–1)
 * @returns {{
 *   pYellowCard:         number,
 *   pRedCard:            number,
 *   expectedCardPoints:  number
 * }}
 */
const computeDisciplineRisk = (player, minutesFraction = 1) => {
  const position      = player.element_type;
  const baseYellow    = POSITION_YELLOW_RATE[position] || 0.05;
  const baseRed       = BASE_RED_CARD_RATE;

  const yellowCards   = num(player.yellow_cards);
  const redCards      = num(player.red_cards);
  const totalMins     = num(player.minutes);

  let pYellow, pRed;

  if (totalMins >= 450) {
    // At least 5 full games — use player-specific historical rate
    const gamesPlayed       = totalMins / 90;
    const historicalYellow  = yellowCards / gamesPlayed;
    const historicalRed     = redCards    / gamesPlayed;

    // Blend 60% historical + 40% position prior to regress extreme values
    pYellow = historicalYellow * 0.60 + baseYellow * 0.40;
    pRed    = historicalRed    * 0.60 + baseRed    * 0.40;
  } else {
    pYellow = baseYellow;
    pRed    = baseRed;
  }

  // Scale by expected playing time (fewer minutes → proportionally fewer cards)
  pYellow *= Math.min(1, Math.max(0, minutesFraction));
  pRed    *= Math.min(1, Math.max(0, minutesFraction));

  // Hard caps (a player can't have >30% yellow-card rate per game)
  pYellow = Math.min(0.30, Math.max(0, pYellow));
  pRed    = Math.min(0.05, Math.max(0, pRed));

  const expectedCardPoints = -(pYellow * 1 + pRed * 3);

  return {
    pYellowCard:        pYellow,
    pRedCard:           pRed,
    expectedCardPoints: Math.min(0, expectedCardPoints),
  };
};

module.exports = {
  computeDisciplineRisk,
  POSITION_YELLOW_RATE,
  BASE_RED_CARD_RATE,
};
