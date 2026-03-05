'use strict';

/**
 * Monte Carlo match simulation engine.
 *
 * Simulates a fixture thousands of times to generate a full probability
 * distribution of outcomes for each player, rather than a single point
 * estimate.  The simulated distributions are then aggregated to provide:
 *
 *   - Average goals / assists per player
 *   - Clean-sheet probability
 *   - 90th-percentile ceiling outcomes
 *
 * Outputs feed into the FPL scorer for expected points and variance.
 */

const { samplePoisson } = require('./poissonModel');
const { ASSISTED_FRACTION } = require('./playerContributionModel');

/** Number of simulations to run per fixture. Higher = more accurate but slower. */
const N_SIMULATIONS = 750;

/**
 * Perform a weighted random draw from an array of items.
 * Each item must have a numeric weight at the given key.
 * Returns null if the array is empty or all weights are zero.
 *
 * @param {Array}  items     - Objects to sample from
 * @param {string} weightKey - Key of the weight field
 * @returns {Object|null}
 */
const weightedSample = (items, weightKey) => {
  if (!items || items.length === 0) return null;
  const total = items.reduce((s, it) => s + (it[weightKey] || 0), 0);
  if (total <= 0) {
    return items[Math.floor(Math.random() * items.length)];
  }
  let rand = Math.random() * total;
  for (const item of items) {
    rand -= item[weightKey] || 0;
    if (rand <= 0) return item;
  }
  return items[items.length - 1];
};

/**
 * Simulate one match and allocate goals / assists to players.
 *
 * @param {number} homeLambda   - Expected goals for home team
 * @param {number} awayLambda   - Expected goals for away team
 * @param {Array}  homePlayers  - Home players with goalShare / assistShare
 * @param {Array}  awayPlayers  - Away players with goalShare / assistShare
 * @returns {{
 *   homeGoals: number,
 *   awayGoals: number,
 *   homeCS: boolean,
 *   awayCS: boolean,
 *   homeEvents: Object,
 *   awayEvents: Object
 * }}
 */
const simulateMatch = (homeLambda, awayLambda, homePlayers, awayPlayers) => {
  const homeGoals = samplePoisson(homeLambda);
  const awayGoals = samplePoisson(awayLambda);

  const homeCS = awayGoals === 0;
  const awayCS = homeGoals === 0;

  /**
   * Allocate `goals` scored by `attackers` among `attackers` and `assisters`.
   * Only players with positive goalShare / assistShare are eligible.
   */
  const allocate = (goals, attackers) => {
    const events = {};
    attackers.forEach((p) => { events[p.id] = { goals: 0, assists: 0 }; });

    // Only players with non-zero shares participate in scoring
    const eligibleScorers   = attackers.filter((p) => (p.goalShare   || 0) > 0);
    const eligibleAssisters = attackers.filter((p) => (p.assistShare || 0) > 0);

    for (let g = 0; g < goals; g++) {
      const scorer = weightedSample(eligibleScorers, 'goalShare');
      if (scorer) events[scorer.id].goals += 1;

      if (Math.random() < ASSISTED_FRACTION) {
        // Exclude the scorer from assist candidates
        const candidates = scorer
          ? eligibleAssisters.filter((p) => p.id !== scorer.id)
          : eligibleAssisters;
        const assister = weightedSample(candidates, 'assistShare');
        if (assister) events[assister.id].assists += 1;
      }
    }
    return events;
  };

  return {
    homeGoals,
    awayGoals,
    homeCS,
    awayCS,
    homeEvents: allocate(homeGoals, homePlayers),
    awayEvents: allocate(awayGoals, awayPlayers),
  };
};

/**
 * Run N_SIMULATIONS Monte Carlo iterations for a fixture.
 *
 * @param {number} homeLambda   - Expected goals for home team
 * @param {number} awayLambda   - Expected goals for away team
 * @param {Array}  homePlayers  - Array of { id, goalShare, assistShare }
 * @param {Array}  awayPlayers  - Array of { id, goalShare, assistShare }
 * @returns {Object} Map of player_id → {
 *   avgGoals:        number,
 *   avgAssists:      number,
 *   cleanSheetProb:  number,
 *   goalsCeil:       number,   (90th percentile)
 *   assistsCeil:     number
 * }
 */
const runSimulations = (homeLambda, awayLambda, homePlayers, awayPlayers) => {
  // Initialise accumulators
  const acc = {};
  const initialise = (players) =>
    players.forEach((p) => {
      acc[p.id] = { totalGoals: 0, totalAssists: 0, cleanSheets: 0, goalsArr: [], assistsArr: [] };
    });
  initialise(homePlayers);
  initialise(awayPlayers);

  for (let i = 0; i < N_SIMULATIONS; i++) {
    const { homeGoals, awayGoals, homeCS, awayCS, homeEvents, awayEvents } =
      simulateMatch(homeLambda, awayLambda, homePlayers, awayPlayers);

    homePlayers.forEach((p) => {
      const ev = homeEvents[p.id] || { goals: 0, assists: 0 };
      acc[p.id].totalGoals   += ev.goals;
      acc[p.id].totalAssists += ev.assists;
      acc[p.id].goalsArr.push(ev.goals);
      acc[p.id].assistsArr.push(ev.assists);
      if (homeCS) acc[p.id].cleanSheets += 1;
    });

    awayPlayers.forEach((p) => {
      const ev = awayEvents[p.id] || { goals: 0, assists: 0 };
      acc[p.id].totalGoals   += ev.goals;
      acc[p.id].totalAssists += ev.assists;
      acc[p.id].goalsArr.push(ev.goals);
      acc[p.id].assistsArr.push(ev.assists);
      if (awayCS) acc[p.id].cleanSheets += 1;
    });
  }

  // Aggregate results
  const results = {};
  [...homePlayers, ...awayPlayers].forEach((p) => {
    const a = acc[p.id];
    if (!a) return;

    const goalsArr   = a.goalsArr.slice().sort((x, y) => x - y);
    const assistsArr = a.assistsArr.slice().sort((x, y) => x - y);
    const p90idx     = Math.floor(N_SIMULATIONS * 0.9);

    results[p.id] = {
      avgGoals:       a.totalGoals   / N_SIMULATIONS,
      avgAssists:     a.totalAssists / N_SIMULATIONS,
      cleanSheetProb: a.cleanSheets  / N_SIMULATIONS,
      goalsCeil:      goalsArr[p90idx]   || 0,
      assistsCeil:    assistsArr[p90idx] || 0,
    };
  });

  return results;
};

module.exports = {
  runSimulations,
  simulateMatch,
  weightedSample,
  N_SIMULATIONS,
};
