'use strict';

/**
 * Goalkeeper save model.
 *
 * Estimates expected saves per game from opponent attacking strength
 * (expressed as the opponent's expected goals lambda), then translates
 * that into expected FPL save points.
 *
 * FPL rule: 1 point awarded per 3 saves.
 * E[floor(saves / 3)] is computed via the Poisson PMF for exactness.
 */

const { poissonPMF } = require('./poissonModel');

/**
 * Fraction of shots on target that the goalkeeper saves.
 * EPL average: ~65–70% save rate.
 */
const SAVE_RATE = 0.67;

/**
 * Shots-on-target per expected goal in EPL.
 * Average goals/shots-on-target ≈ 0.33 (i.e. ~33% conversion from SoT),
 * so SoT ≈ goals / 0.33 ≈ goals × 3.03.
 */
const GOALS_TO_SHOTS_ON_TARGET = 3.03;

/**
 * Estimate expected saves for a goalkeeper given opponent expected goals.
 *
 * @param {number} opponentLambda - Opponent's expected goals for the fixture
 * @returns {number} Expected number of saves (non-negative)
 */
const estimateExpectedSaves = (opponentLambda) => {
  const expectedShotsOnTarget = opponentLambda * GOALS_TO_SHOTS_ON_TARGET;
  // Saves = SoT that don't result in goals
  const expectedSaves = expectedShotsOnTarget * SAVE_RATE;
  return Math.max(0, expectedSaves);
};

/**
 * Expected FPL save points: E[ floor(saves / 3) ].
 * Computed exactly using the Poisson PMF up to an upper bound of 20 saves.
 *
 * @param {number} expectedSaves - Expected save count
 * @returns {number} Expected save points
 */
const expectedSavePoints = (expectedSaves) => {
  const lambda = Math.max(0.001, expectedSaves);
  let points = 0;
  for (let s = 0; s <= 20; s++) {
    points += Math.floor(s / 3) * poissonPMF(s, lambda);
  }
  return Math.max(0, points);
};

/**
 * Full goalkeeper contribution prediction for a fixture.
 *
 * @param {number} opponentLambda - Expected goals against (opponent's lambda)
 * @returns {{
 *   expectedSaves:      number,
 *   expectedSavePoints: number,
 *   pPenaltySave:       number
 * }}
 */
const predictGoalkeeperContribution = (opponentLambda) => {
  const expSaves     = estimateExpectedSaves(opponentLambda);
  const expSavePts   = expectedSavePoints(expSaves);

  // Penalty save probability: ~1–2 penalties per team per 10 games → ~1% per game
  const pPenaltySave = 0.012;

  return {
    expectedSaves:      expSaves,
    expectedSavePoints: expSavePts,
    pPenaltySave,
  };
};

module.exports = {
  estimateExpectedSaves,
  expectedSavePoints,
  predictGoalkeeperContribution,
};
