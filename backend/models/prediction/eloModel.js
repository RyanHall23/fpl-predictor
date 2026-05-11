'use strict';

/**
 * ELO-based team strength model.
 *
 * Converts FPL team strength ratings (which range roughly 900–1500) into
 * Poisson goal-rate multipliers, then derives expected goals per fixture.
 *
 * Separate attack and defense ratings are maintained for home and away
 * contexts, reflecting the well-documented home-advantage effect.
 *
 * Dynamic Elo: `buildDynamicTeamRatings` computes Elo ratings updated from
 * every completed fixture result, producing a live-season signal that
 * `buildTeamRatings` (static FPL strengths) cannot capture.  The two are
 * blended in `computeExpectedGoalsWithDynamic`.
 */

const AVERAGE_GOALS_PER_GAME = 1.35; // EPL long-run mean
const HOME_ADVANTAGE_FACTOR = 1.15;  // Home team scores ~15% more on average

// ── Dynamic Elo parameters ─────────────────────────────────────────────────

/** Starting Elo for each team at season kick-off. */
const ELO_BASE = 1500;

/**
 * K-factor: how much a single result shifts ratings.
 * Lower K = more stable; higher K = more reactive.
 * 32 is standard for medium-length seasons (~38 games).
 */
const ELO_K = 32;

/**
 * Goal difference multiplier for Elo updates.
 * A win by 3+ goals should shift ratings more than a 1-0 win.
 * Capped to prevent huge upsets from dominating.
 */
const goalDiffMultiplier = (gd) => {
  if (gd <= 1) return 1.0;
  if (gd === 2) return 1.5;
  return 1.75; // cap at 3+ goal margin
};

/**
 * Compute dynamic Elo ratings for all teams by replaying completed fixtures.
 *
 * @param {Array} completedFixtures - Fixtures with finished===true and scores
 * @param {Array} teams             - All teams (for ID seeding)
 * @returns {Object} Map: teamId → { eloRating, gamesPlayed }
 */
const buildDynamicTeamRatings = (completedFixtures, teams) => {
  // Seed all teams at ELO_BASE
  const ratings = {};
  teams.forEach((t) => { ratings[t.id] = { eloRating: ELO_BASE, gamesPlayed: 0 }; });

  // Replay results chronologically
  const sorted = [...completedFixtures]
    .filter((f) => f.team_h_score != null && f.team_a_score != null)
    .sort((a, b) => (a.event || 0) - (b.event || 0));

  sorted.forEach((f) => {
    const hId = f.team_h;
    const aId = f.team_a;
    if (!ratings[hId]) ratings[hId] = { eloRating: ELO_BASE, gamesPlayed: 0 };
    if (!ratings[aId]) ratings[aId] = { eloRating: ELO_BASE, gamesPlayed: 0 };

    const hElo = ratings[hId].eloRating;
    const aElo = ratings[aId].eloRating;

    const hGoals = Number(f.team_h_score);
    const aGoals = Number(f.team_a_score);

    // Expected win probability (logistic scale)
    // Apply home advantage as a virtual +100 Elo rating for expectation
    const hExpected = 1 / (1 + Math.pow(10, (aElo - (hElo + 100)) / 400));
    const aExpected = 1 - hExpected;

    // Actual outcome: 1 = win, 0.5 = draw, 0 = loss
    let hScore, aScore;
    if (hGoals > aGoals)      { hScore = 1;   aScore = 0; }
    else if (hGoals < aGoals) { hScore = 0;   aScore = 1; }
    else                      { hScore = 0.5; aScore = 0.5; }

    const gd = Math.abs(hGoals - aGoals);
    const mult = goalDiffMultiplier(gd);

    ratings[hId].eloRating  += ELO_K * mult * (hScore - hExpected);
    ratings[aId].eloRating  += ELO_K * mult * (aScore - aExpected);
    ratings[hId].gamesPlayed += 1;
    ratings[aId].gamesPlayed += 1;
  });

  return ratings;
};

/**
 * Compute expected goals using blended static-FPL + dynamic-Elo ratings.
 *
 * @param {number} homeTeamId       - Home team's FPL id
 * @param {number} awayTeamId       - Away team's FPL id
 * @param {Object} staticRatings    - Output of buildTeamRatings()
 * @param {Object} dynamicRatings   - Output of buildDynamicTeamRatings()
 * @returns {{ homeLambda: number, awayLambda: number }}
 */
const computeExpectedGoalsWithDynamic = (homeTeamId, awayTeamId, staticRatings, dynamicRatings) => {
  // Static-based lambda (existing method)
  const staticResult = computeExpectedGoals(homeTeamId, awayTeamId, staticRatings);

  const hDyn = dynamicRatings[homeTeamId];
  const aDyn = dynamicRatings[awayTeamId];

  // If either team has too few dynamic games, fall back to static only
  if (!hDyn || !aDyn || hDyn.gamesPlayed < 3 || aDyn.gamesPlayed < 3) {
    return staticResult;
  }

  // Dynamic expected goals: convert Elo difference to a lambda ratio.
  // The formula mirrors the static strength→rate conversion but uses live Elo.
  const avgElo = (hDyn.eloRating + aDyn.eloRating) / 2;
  const homeDynLambda = AVERAGE_GOALS_PER_GAME *
    Math.exp((hDyn.eloRating - avgElo) / 700) *
    Math.exp(-(aDyn.eloRating - avgElo) / 700) *
    HOME_ADVANTAGE_FACTOR;
  const awayDynLambda = AVERAGE_GOALS_PER_GAME *
    Math.exp((aDyn.eloRating - avgElo) / 700) *
    Math.exp(-(hDyn.eloRating - avgElo) / 700);

  // Blend: 60% static (more data, position-specific) + 40% dynamic (recent form)
  const blendStatic  = 0.60;
  const blendDynamic = 0.40;

  return {
    homeLambda: Math.max(0.3, Math.min(4.5,
      blendStatic * staticResult.homeLambda + blendDynamic * Math.max(0.3, homeDynLambda)
    )),
    awayLambda: Math.max(0.2, Math.min(4.0,
      blendStatic * staticResult.awayLambda + blendDynamic * Math.max(0.2, awayDynLambda)
    )),
  };
};

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
  buildDynamicTeamRatings,
  computeExpectedGoals,
  computeExpectedGoalsWithDynamic,
  AVERAGE_GOALS_PER_GAME,
  HOME_ADVANTAGE_FACTOR,
};
