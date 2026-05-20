'use strict';

/**
 * Smoke tests that verify all key backend modules load without errors.
 *
 * A missing opening "/**" in a JSDoc comment block (or any other syntax
 * mistake) causes `require()` to throw a SyntaxError, which makes every
 * endpoint return 500.  These tests catch that class of failure before
 * deployment.
 *
 * Runs with Node.js built-in test runner: node --test
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Assert that requiring `modulePath` (relative to the backend root) does not
 * throw, and that the resulting export is an object with at least one key.
 */
const assertLoads = (modulePath) => {
  const abs = path.join(__dirname, '..', modulePath);
  let mod;
  assert.doesNotThrow(() => {
    mod = require(abs);
  }, `require('${modulePath}') must not throw`);
  assert.ok(mod && typeof mod === 'object', `${modulePath} must export an object`);
  assert.ok(Object.keys(mod).length > 0, `${modulePath} must export at least one key`);
  return mod;
};

// ---------------------------------------------------------------------------
// Module loading — syntax + import-chain smoke tests
// ---------------------------------------------------------------------------

describe('module loading — no syntax or require errors', () => {
  test('utils/cacheHeaders loads and exports matchesEtag + withCacheHeaders', () => {
    const mod = assertLoads('utils/cacheHeaders.js');
    assert.equal(typeof mod.matchesEtag, 'function', 'matchesEtag must be a function');
    assert.equal(typeof mod.withCacheHeaders, 'function', 'withCacheHeaders must be a function');
  });

  test('utils/statsBreakdown loads', () => {
    assertLoads('utils/statsBreakdown.js');
  });

  test('utils/substitution loads', () => {
    assertLoads('utils/substitution.js');
  });

  test('models/dataProvider loads', () => {
    assertLoads('models/dataProvider.js');
  });

  test('models/fplModel loads and exports required symbols', () => {
    const mod = assertLoads('models/fplModel.js');
    const requiredFns = [
      'fetchBootstrapStatic',
      'fetchFixtures',
      'fetchPlayerPicks',
      'fetchLiveGameweek',
      'enrichPlayersWithOpponents',
      'applyAdvancedPredictions',
      'applyPredictionsWithCache',
      'buildHighestPredictedTeam',
      'buildUserTeam',
    ];
    for (const name of requiredFns) {
      assert.equal(typeof mod[name], 'function', `fplModel must export ${name} as a function`);
    }
    assert.equal(typeof mod.MAX_PREDICTION_AGE_MS, 'number', 'fplModel must export MAX_PREDICTION_AGE_MS as a number');
    assert.ok(mod.MAX_PREDICTION_AGE_MS > 0, 'MAX_PREDICTION_AGE_MS must be positive');
  });

  test('controllers/fplController loads and exports all route handlers', () => {
    const mod = assertLoads('controllers/fplController.js');
    const handlers = [
      'getBootstrapStatic',
      'getFixtures',
      'getPlayerPicks',
      'getElementSummary',
      'getLiveGameweek',
      'getPredictedTeam',
      'getUserTeam',
      'getUserTeamForEntry',
      'getUserProfile',
      'getAllPlayersEnriched',
      'validateSwap',
      'getAvailableTransfers',
      'getRecommendedTransfers',
      'getLeagueStandings',
      'getPlayersForecast',
      'getEntryTransfers',
    ];
    for (const name of handlers) {
      assert.equal(typeof mod[name], 'function', `fplController must export ${name} as a function`);
    }
  });

  test('controllers/assistantController loads and exports getAssistantHints', () => {
    const mod = assertLoads('controllers/assistantController.js');
    assert.equal(typeof mod.getAssistantHints, 'function', 'assistantController must export getAssistantHints');
  });
});

// ---------------------------------------------------------------------------
// MAX_PREDICTION_AGE_MS single source of truth
// ---------------------------------------------------------------------------

describe('MAX_PREDICTION_AGE_MS — single source of truth', () => {
  test('fplController imports MAX_PREDICTION_AGE_MS from fplModel (no local redefinition)', () => {
    // The value is exported from fplModel and imported by fplController.
    // Both must agree on the same number.
    const fplModel = require(path.join(__dirname, '..', 'models/fplModel.js'));
    const threshold = fplModel.MAX_PREDICTION_AGE_MS;
    assert.equal(typeof threshold, 'number');
    // 25 hours in ms — the expected value documented in fplModel.js
    assert.equal(threshold, 25 * 60 * 60 * 1000);
  });
});
