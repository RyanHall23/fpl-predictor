'use strict';

/**
 * ELO-based team strength model.
 *
 * Converts FPL team strength ratings (which range roughly 900–1500) into
 * Poisson goal-rate multipliers, then derives expected goals per fixture.
 *
 * Separate attack and defense ratings are maintained for home and away
 * contexts, reflecting the well-documented home-advantage effect.
 */

const AVERAGE_GOALS_PER_GAME = 1.35; // EPL long-run mean
const HOME_ADVANTAGE_FACTOR = 1.15;  // Home team scores ~15% more on average

/**
 * Convert an FPL strength value to a goal-rate multiplier centred on 1.0.
 * The exponential mapping ensures multipliers are always positive and that
 * strength differences translate to percentage changes in expected goals.
 *
 * The denominator 700 controls sensitivity: it is tuned so that the
 * maximum typical spread in FPL team strengths (~600 points on a
 * 900–1500 scale) produces roughly a 2× difference in goal rates between
 * the strongest and weakest teams, consistent with observed EPL data.
 *
 * @param {number} strength        - FPL team strength value
 * @param {number} averageStrength - League-wide average (computed from all teams)
 * @returns {number} Goal-rate multiplier (> 0)
 */
const strengthToRate = (strength, averageStrength) => {
  return Math.exp((strength - averageStrength) / 700);
};

/**
 * Build per-team rating objects from the FPL bootstrap-static teams array.
 * Returns a map keyed by team id.
 *
 * @param {Array} teams - FPL teams from bootstrap-static
 * @returns {Object} Map: team_id → { attackHomeRate, attackAwayRate, defenseHomeRate, defenseAwayRate }
 */
const buildTeamRatings = (teams) => {
  if (!teams || teams.length === 0) return {};

  const avg = (key) =>
    teams.reduce((s, t) => s + (t[key] || 1200), 0) / teams.length;

  const avgAttHome = avg('strength_attack_home');
  const avgAttAway = avg('strength_attack_away');
  const avgDefHome = avg('strength_defence_home');
  const avgDefAway = avg('strength_defence_away');

  const ratings = {};
  teams.forEach((team) => {
    ratings[team.id] = {
      id: team.id,
      name: team.name,
      shortName: team.short_name,
      attackHomeRate: strengthToRate(team.strength_attack_home  || 1200, avgAttHome),
      attackAwayRate: strengthToRate(team.strength_attack_away  || 1200, avgAttAway),
      defenseHomeRate: strengthToRate(team.strength_defence_home || 1200, avgDefHome),
      defenseAwayRate: strengthToRate(team.strength_defence_away || 1200, avgDefAway),
    };
  });
  return ratings;
};

/**
 * Compute expected goals (lambdas) for a single fixture using team ratings.
 *
 * Formula:
 *   homeLambda = BASE × homeAttack × (1 / awayDefenseAway) × HOME_ADVANTAGE
 *   awayLambda = BASE × awayAttack × (1 / homeDefenseHome)
 *
 * @param {number} homeTeamId - Home team's FPL id
 * @param {number} awayTeamId - Away team's FPL id
 * @param {Object} ratings    - Output of buildTeamRatings()
 * @returns {{ homeLambda: number, awayLambda: number }}
 */
const computeExpectedGoals = (homeTeamId, awayTeamId, ratings) => {
  const home = ratings[homeTeamId];
  const away = ratings[awayTeamId];

  if (!home || !away) {
    return {
      homeLambda: AVERAGE_GOALS_PER_GAME * HOME_ADVANTAGE_FACTOR,
      awayLambda: AVERAGE_GOALS_PER_GAME,
    };
  }

  const homeLambda =
    AVERAGE_GOALS_PER_GAME *
    home.attackHomeRate *
    (1 / away.defenseAwayRate) *
    HOME_ADVANTAGE_FACTOR;

  const awayLambda =
    AVERAGE_GOALS_PER_GAME *
    away.attackAwayRate *
    (1 / home.defenseHomeRate);

  return {
    homeLambda: Math.max(0.3, Math.min(4.5, homeLambda)),
    awayLambda: Math.max(0.2, Math.min(4.0, awayLambda)),
  };
};

module.exports = {
  buildTeamRatings,
  computeExpectedGoals,
  AVERAGE_GOALS_PER_GAME,
  HOME_ADVANTAGE_FACTOR,
};
