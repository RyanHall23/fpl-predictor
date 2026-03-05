'use strict';

/**
 * Poisson distribution utilities for football goal modelling.
 *
 * The Poisson process is the standard statistical tool for estimating
 * goal-scoring probabilities in football. Given an expected goals rate
 * (lambda), it returns the probability of scoring exactly k goals.
 */

/**
 * Iterative factorial to avoid stack overflow for values up to ~20.
 * Returns 1 for n <= 1 for safety.
 */
const factorial = (n) => {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
};

/**
 * Poisson probability mass function: P(X = k | lambda)
 * @param {number} k     - Non-negative integer
 * @param {number} lambda - Rate parameter (expected value), must be > 0
 * @returns {number} Probability
 */
const poissonPMF = (k, lambda) => {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  if (k < 0 || !Number.isInteger(k)) return 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
};

/**
 * Generate a goal-count probability distribution array.
 * @param {number} lambda   - Expected goals
 * @param {number} maxGoals - Upper bound for the array (default 8 covers >99.9% of EPL matches)
 * @returns {number[]} P(X=0), P(X=1), …, P(X=maxGoals)
 */
const goalDistribution = (lambda, maxGoals = 8) => {
  const dist = [];
  for (let k = 0; k <= maxGoals; k++) {
    dist.push(poissonPMF(k, lambda));
  }
  return dist;
};

/**
 * P(goals conceded = 0) i.e. clean-sheet probability for the defending team.
 * @param {number} opponentLambda - Expected goals by the attacking team
 * @returns {number}
 */
const cleanSheetProbability = (opponentLambda) => poissonPMF(0, opponentLambda);

/**
 * P(X >= n) — probability of at least n goals.
 * @param {number} lambda - Rate
 * @param {number} n      - Threshold (inclusive lower bound)
 * @returns {number}
 */
const probAtLeast = (lambda, n) => {
  let cumulative = 0;
  for (let k = 0; k < n; k++) {
    cumulative += poissonPMF(k, lambda);
  }
  return Math.max(0, Math.min(1, 1 - cumulative));
};

/**
 * Expected negative FPL points from goals conceded for GK / DEF.
 * FPL rule: -1 point per 2 goals conceded.
 * E[ floor(goals / 2) ] is computed exactly via the Poisson PMF.
 * @param {number} lambda - Expected goals conceded
 * @returns {number} Expected negative points (already negative)
 */
const expectedGoalsConcededPenalty = (lambda) => {
  let expected = 0;
  for (let k = 0; k <= 12; k++) {
    expected += Math.floor(k / 2) * poissonPMF(k, Math.max(0.001, lambda));
  }
  return -expected;
};

/**
 * Sample a Poisson-distributed integer using the Knuth algorithm.
 * Suitable for lambda values up to ~30 before precision loss.
 * @param {number} lambda - Rate parameter
 * @returns {number} Non-negative integer sample
 */
const samplePoisson = (lambda) => {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
};

module.exports = {
  poissonPMF,
  goalDistribution,
  cleanSheetProbability,
  probAtLeast,
  expectedGoalsConcededPenalty,
  samplePoisson,
};
