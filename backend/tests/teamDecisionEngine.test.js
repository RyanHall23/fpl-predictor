'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { recommendTransfers } = require('../models/teamDecisionEngine');

const makePlayer = (overrides = {}) => ({
  id: 1,
  web_name: 'Player',
  element_type: 3,
  team: 1,
  now_cost: 70,
  ep_next: 5,
  ...overrides,
});

describe('recommendTransfers', () => {
  test('does not recommend a player out before their current fixture finishes', () => {
    const squad = [makePlayer({ currentGameweekFixtures: [{ finished: false }] })];
    const replacement = makePlayer({ id: 2, team: 2, ep_next: 10 });

    assert.deepEqual(recommendTransfers(squad, [replacement], 0, 1), []);
  });

  test('includes confidence for completed fixtures', () => {
    const squad = [makePlayer({ currentGameweekFixtures: [{ finished: true }] })];
    const replacement = makePlayer({ id: 2, team: 2, ep_next: 7 });

    const [transfer] = recommendTransfers(squad, [replacement], 0, 1);

    assert.equal(transfer.playerOut.id, 1);
    assert.equal(transfer.playerIn.id, 2);
    assert.equal(transfer.confidence, 'high');
    assert.equal(transfer.confidenceScore >= 75, true);
  });

  test('does not recommend a transfer when a hit costs more than its gain', () => {
    const squad = [makePlayer({ currentGameweekFixtures: [{ finished: true }] })];
    const replacement = makePlayer({ id: 2, team: 2, ep_next: 5.5 });

    assert.deepEqual(recommendTransfers(squad, [replacement], 0, 0), []);
  });
});
