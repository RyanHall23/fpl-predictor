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
 *   3. Apply a fixture-tension multiplier: evenly-matched teams (small ELO gap)
 *      produce more physical, card-heavy games.
 *   4. Exposure-weight so players who play fewer minutes get proportionally
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
 * Compute a fixture-tension multiplier based on the Elo strength gap.
 *
 * When two teams are closely matched (small Elo gap) the game tends to be
 * more physical and card-heavy.  A large Elo gap (dominant team vs minnow)
 * produces fewer cards as the contest is more one-sided.
 *
 * The multiplier ranges linearly from 1.20 (gap = 0, evenly matched) down to
 * 0.85 (gap ≥ 300 Elo points, one-sided contest).  No separate clamp is
 * needed because the formula is fully bounded by construction.
 *
 * @param {number|null} homeElo - Home team Elo (from dynamicTeamRatings), or null
 * @param {number|null} awayElo - Away team Elo, or null
 * @returns {number} Multiplier in [0.85, 1.20] to apply to base card rates
 */
const fixtureTensionMultiplier = (homeElo, awayElo) => {
  if (homeElo == null || awayElo == null) return 1.0;
  const gap = Math.abs(homeElo - awayElo);
  // Max tension when gap = 0; min tension when gap >= 300 Elo points
  const normalised = Math.min(1, gap / 300);
  // Linear from 1.20 (gap=0) to 0.85 (gap≥300)
  return 1.20 - normalised * 0.35;
};

/**
 * Compute discipline risk for a player.
 *
 * @param {Object} player          - FPL element from bootstrap-static
 * @param {number} minutesFraction - Fraction of 90 mins expected this fixture (0–1)
 * @param {Object} [fixtureCtx]    - Optional fixture context:
 *   { homeElo: number, awayElo: number }  (from dynamicTeamRatings)
 * @returns {{
 *   pYellowCard:         number,
 *   pRedCard:            number,
 *   expectedCardPoints:  number
 * }}
 */
const computeDisciplineRisk = (player, minutesFraction = 1, fixtureCtx = {}) => {
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

  // Apply fixture-tension multiplier
  const tensionMult = fixtureTensionMultiplier(
    fixtureCtx.homeElo ?? null,
    fixtureCtx.awayElo ?? null,
  );
  pYellow *= tensionMult;
  pRed    *= tensionMult;

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
  fixtureTensionMultiplier,
  POSITION_YELLOW_RATE,
  BASE_RED_CARD_RATE,
};

