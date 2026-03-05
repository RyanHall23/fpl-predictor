'use strict';

/**
 * Player goal-contribution model.
 *
 * Distributes a team's expected goals to individual players using their
 * attacking-involvement metrics (xG, xA, goals, assists from season stats).
 *
 * Outputs P(goal) and P(assist) per player per fixture, scaled by the
 * team-level expected goal value from the ELO model.
 */

const num = (v) => {
  if (v == null) return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Attacking-involvement score weights.
 * xG is weighted most heavily (2.5×) because it directly predicts goal-scoring.
 * xA is weighted 2.0× as it predicts assist probability.
 * Actual goals/assists (0.4× / 0.3×) are blended in lightly for smoothing
 * against small-sample xG noise — lower weights prevent overfitting to
 * players with lucky early-season conversion rates.
 */
const W_XG      = 2.5;
const W_XA      = 2.0;
const W_GOALS   = 0.4;
const W_ASSISTS = 0.3;
const POSITION_PRIOR_WEIGHT = {
  1: 0.01,  // GK
  2: 0.06,  // DEF
  3: 0.18,  // MID
  4: 0.35,  // FWD
};

/**
 * Compute a player's raw attacking-involvement score from season stats.
 * Higher → more likely to contribute to team goals.
 *
 * @param {Object} player - FPL element
 * @returns {number} Non-negative involvement score
 */
const attackingInvolvementScore = (player) => {
  const xG     = num(player.expected_goals);
  const xA     = num(player.expected_assists);
  const goals  = num(player.goals_scored);
  const assists = num(player.assists);

  // xG contributes most for goal share; xA for assist share.
  // Actual goals/assists are blended in as smoothing.
  const score = xG * W_XG + xA * W_XA + goals * W_GOALS + assists * W_ASSISTS;

  // Fall back to position prior if no data available
  const posWeight = POSITION_PRIOR_WEIGHT[player.element_type] || 0.08;
  return score > 0 ? score : posWeight;
};

/**
 * Compute a player's proportional share of team goals and assists.
 *
 * @param {Object} player      - Target player
 * @param {Array}  teamPlayers - All players on the same team (from bootstrap-static)
 * @returns {{ goalShare: number, assistShare: number }} Values in [0, 1], total may exceed 1 within team
 */
const computePlayerShares = (player, teamPlayers) => {
  const playerGoalScore  = attackingInvolvementScore(player);

  const teamGoalTotal = teamPlayers.reduce(
    (s, p) => s + attackingInvolvementScore(p),
    0
  );

  if (teamGoalTotal <= 0) {
    const posWeight = POSITION_PRIOR_WEIGHT[player.element_type] || 0.08;
    return { goalShare: posWeight, assistShare: posWeight * 0.75 };
  }

  const share = playerGoalScore / teamGoalTotal;

  // Slightly de-weight assist share vs goal share for prolific scorers,
  // and slightly up-weight it for high-xA players.
  const xG = num(player.expected_goals);
  const xA = num(player.expected_assists);
  const involvementTotal = xG + xA + 0.01;
  const goalBias   = (xG / involvementTotal + 0.5) / 1.5;
  const assistBias = (xA / involvementTotal + 0.5) / 1.5;

  return {
    goalShare:   Math.min(1, Math.max(0, share * goalBias)),
    assistShare: Math.min(1, Math.max(0, share * assistBias)),
  };
};

/**
 * Fraction of EPL goals that have a recorded assist (~82%).
 * Exported so the match simulator can reuse the same constant.
 */
const ASSISTED_FRACTION = 0.82;

/**
 * Compute expected goals and assists for a single player in a single fixture.
 *
 * @param {Object} player            - FPL element
 * @param {Array}  teamPlayers       - All players on the same team
 * @param {number} teamExpectedGoals - Team-level xG for this fixture (from ELO model)
 * @returns {{
 *   expectedGoals:   number,
 *   expectedAssists: number,
 *   pGoal:           number,
 *   pAssist:         number,
 *   goalShare:       number,
 *   assistShare:     number
 * }}
 */
const computePlayerGoalContribution = (player, teamPlayers, teamExpectedGoals) => {
  const { goalShare, assistShare } = computePlayerShares(player, teamPlayers);

  const expectedGoals = teamExpectedGoals * goalShare;

  // ~82% of EPL goals have a recorded assist (see ASSISTED_FRACTION constant)
  const expectedAssists = teamExpectedGoals * ASSISTED_FRACTION * assistShare;

  // Poisson approximation for P(at least one)
  const pGoal   = 1 - Math.exp(-Math.max(0, expectedGoals));
  const pAssist = 1 - Math.exp(-Math.max(0, expectedAssists));

  return {
    expectedGoals:   Math.max(0, expectedGoals),
    expectedAssists: Math.max(0, expectedAssists),
    pGoal:   Math.min(1, Math.max(0, pGoal)),
    pAssist: Math.min(1, Math.max(0, pAssist)),
    goalShare,
    assistShare,
  };
};

module.exports = {
  computePlayerGoalContribution,
  computePlayerShares,
  attackingInvolvementScore,
  POSITION_PRIOR_WEIGHT,
  ASSISTED_FRACTION,
};
