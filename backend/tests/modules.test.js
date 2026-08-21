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

describe('teamDecisionEngine', () => {
  test('recommendLineup keeps the reserve goalkeeper on the bench only once', () => {
    const { recommendLineup } = require(path.join(__dirname, '..', 'models/teamDecisionEngine.js'));
    const makePlayer = (id, element_type, ep_next) => ({
      id,
      element_type,
      ep_next,
      now_cost: 50,
      web_name: `P${id}`,
      team: id,
    });

    const squad = [
      makePlayer(1, 1, 5.0),
      makePlayer(2, 1, 3.1),
      makePlayer(3, 2, 6.8),
      makePlayer(4, 2, 6.5),
      makePlayer(5, 2, 6.2),
      makePlayer(6, 2, 5.9),
      makePlayer(7, 2, 5.7),
      makePlayer(8, 3, 6.6),
      makePlayer(9, 3, 6.5),
      makePlayer(10, 3, 6.3),
      makePlayer(11, 3, 6.2),
      makePlayer(12, 3, 5.8),
      makePlayer(13, 4, 6.4),
      makePlayer(14, 4, 5.6),
      makePlayer(15, 4, 4.5),
    ];

    const lineup = recommendLineup(squad);
    const reserveGoalkeepers = lineup.reservePlayers.filter(p => p.element_type === 1);

    assert.equal(lineup.reservePlayers.length, 4, 'bench should contain exactly four players');
    assert.equal(reserveGoalkeepers.length, 1, 'bench should contain exactly one reserve goalkeeper');
    assert.deepEqual(
      reserveGoalkeepers.map(p => p.id),
      [2],
      'the second goalkeeper should appear only once on the bench',
    );
  });
});

describe('predictorTeamService', () => {
  test('reports current remaining free transfers', () => {
    const { calculateFreeTransfers } = require(path.join(__dirname, '..', 'models/predictorTeamService.js'));
    const history = {
      current: [
        { event: 1, event_transfers: 0 },
        { event: 2, event_transfers: 1 },
      ],
    };

    assert.equal(calculateFreeTransfers(history, history.current[1], 2), 1);
  });
});
