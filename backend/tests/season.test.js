'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { getSeasonState } = require('../utils/season');
const { buildBreakdown } = require('../utils/statsBreakdown');

describe('season state', () => {
  test('advances when the next deadline has passed despite a stale current flag', () => {
    const state = getSeasonState([
      { id: 1, finished: true, is_current: true, is_next: false, deadline_time: '2026-08-21T17:30:00Z' },
      { id: 2, finished: false, is_current: false, is_next: true, deadline_time: '2026-08-28T17:30:00Z' },
    ], new Date('2026-08-28T18:00:00Z'));

    assert.equal(state.currentGameweek, 2);
    assert.equal(state.currentEvent.id, 2);
    assert.equal(state.isEventActive(state.currentEvent), true);
  });
});

describe('settled GW1 player points', () => {
  test('matches the authoritative player snapshot for Raya and Gabriel', () => {
    const raya = { minutes: 90, clean_sheets: 1, saves: 1, bonus: 0 };
    const gabriel = { minutes: 90, clean_sheets: 1, yellow_cards: 1, defensive_contribution: 4, bonus: 0 };

    const rayaPoints = buildBreakdown(raya, 1).reduce((sum, row) => sum + row.points, 0);
    const gabrielPoints = buildBreakdown(gabriel, 2).reduce((sum, row) => sum + row.points, 0);

    assert.equal(rayaPoints, 6);
    assert.equal(gabrielPoints, 5);
  });
});