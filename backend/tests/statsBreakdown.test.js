'use strict';

/**
 * Tests for backend/utils/statsBreakdown.js
 * Runs with Node.js built-in test runner: node --test
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { buildBreakdown } = require('../utils/statsBreakdown');

// Helper — base stats entry with zero values for every field
const makeEntry = (overrides = {}) => ({
  minutes: 0,
  goals_scored: 0,
  assists: 0,
  clean_sheets: 0,
  goals_conceded: 0,
  own_goals: 0,
  penalties_saved: 0,
  penalties_missed: 0,
  yellow_cards: 0,
  red_cards: 0,
  saves: 0,
  bonus: 0,
  defensive_contribution: 0,
  ...overrides,
});

describe('buildBreakdown – null / empty input', () => {
  test('returns [] for null entry', () => {
    assert.deepStrictEqual(buildBreakdown(null, 3), []);
  });

  test('returns [] when all stats are zero', () => {
    const rows = buildBreakdown(makeEntry(), 3);
    assert.deepStrictEqual(rows, []);
  });
});

describe('buildBreakdown – minutes played', () => {
  test('< 60 minutes yields 1 point', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 45 }), 3);
    const row = rows.find(r => r.identifier === 'minutes');
    assert.ok(row);
    assert.strictEqual(row.points, 1);
  });

  test('>= 60 minutes yields 2 points', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90 }), 3);
    const row = rows.find(r => r.identifier === 'minutes');
    assert.ok(row);
    assert.strictEqual(row.points, 2);
  });

  test('0 minutes produces no row', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 0 }), 3);
    assert.ok(!rows.find(r => r.identifier === 'minutes'));
  });
});

describe('buildBreakdown – goals scored', () => {
  test('GK goal = 6 pts', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, goals_scored: 1 }), 1);
    assert.strictEqual(rows.find(r => r.identifier === 'goals_scored').points, 6);
  });

  test('DEF goal = 6 pts', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, goals_scored: 1 }), 2);
    assert.strictEqual(rows.find(r => r.identifier === 'goals_scored').points, 6);
  });

  test('MID goal = 5 pts', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, goals_scored: 1 }), 3);
    assert.strictEqual(rows.find(r => r.identifier === 'goals_scored').points, 5);
  });

  test('FWD goal = 4 pts', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, goals_scored: 1 }), 4);
    assert.strictEqual(rows.find(r => r.identifier === 'goals_scored').points, 4);
  });

  test('2 FWD goals = 8 pts', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, goals_scored: 2 }), 4);
    assert.strictEqual(rows.find(r => r.identifier === 'goals_scored').points, 8);
  });
});

describe('buildBreakdown – assists', () => {
  test('1 assist = 3 pts', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, assists: 1 }), 3);
    assert.strictEqual(rows.find(r => r.identifier === 'assists').points, 3);
  });

  test('2 assists = 6 pts', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, assists: 2 }), 3);
    assert.strictEqual(rows.find(r => r.identifier === 'assists').points, 6);
  });
});

describe('buildBreakdown – clean sheets', () => {
  test('GK CS with >= 60 min = 4 pts', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, clean_sheets: 1 }), 1);
    assert.strictEqual(rows.find(r => r.identifier === 'clean_sheets').points, 4);
  });

  test('DEF CS with >= 60 min = 4 pts', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, clean_sheets: 1 }), 2);
    assert.strictEqual(rows.find(r => r.identifier === 'clean_sheets').points, 4);
  });

  test('MID CS with >= 60 min = 1 pt', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, clean_sheets: 1 }), 3);
    assert.strictEqual(rows.find(r => r.identifier === 'clean_sheets').points, 1);
  });

  test('FWD CS produces no row (0 pts)', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, clean_sheets: 1 }), 4);
    assert.ok(!rows.find(r => r.identifier === 'clean_sheets'));
  });

  test('CS with < 60 min produces no row', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 45, clean_sheets: 1 }), 1);
    assert.ok(!rows.find(r => r.identifier === 'clean_sheets'));
  });
});

describe('buildBreakdown – goals conceded', () => {
  test('GK concedes 2 with >= 60 min = -1 pt', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, goals_conceded: 2 }), 1);
    assert.strictEqual(rows.find(r => r.identifier === 'goals_conceded').points, -1);
  });

  test('GK concedes 4 with >= 60 min = -2 pts', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, goals_conceded: 4 }), 1);
    assert.strictEqual(rows.find(r => r.identifier === 'goals_conceded').points, -2);
  });

  test('GK concedes 1 with >= 60 min produces no row (threshold not met)', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, goals_conceded: 1 }), 1);
    assert.ok(!rows.find(r => r.identifier === 'goals_conceded'));
  });

  test('MID concedes 4 produces no row (position not GK/DEF)', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, goals_conceded: 4 }), 3);
    assert.ok(!rows.find(r => r.identifier === 'goals_conceded'));
  });

  test('GK concedes 2 with < 60 min produces no row', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 45, goals_conceded: 2 }), 1);
    assert.ok(!rows.find(r => r.identifier === 'goals_conceded'));
  });
});

describe('buildBreakdown – own goals', () => {
  test('1 own goal = -2 pts', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, own_goals: 1 }), 3);
    assert.strictEqual(rows.find(r => r.identifier === 'own_goals').points, -2);
  });
});

describe('buildBreakdown – penalties', () => {
  test('GK saves penalty = 6 pts', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, penalties_saved: 1 }), 1);
    assert.strictEqual(rows.find(r => r.identifier === 'penalties_saved').points, 6);
  });

  test('non-GK saves penalty produces no row', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, penalties_saved: 1 }), 4);
    assert.ok(!rows.find(r => r.identifier === 'penalties_saved'));
  });

  test('penalty missed = -2 pts', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, penalties_missed: 1 }), 3);
    assert.strictEqual(rows.find(r => r.identifier === 'penalties_missed').points, -2);
  });
});

describe('buildBreakdown – cards', () => {
  test('yellow card = -1 pt', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, yellow_cards: 1 }), 3);
    assert.strictEqual(rows.find(r => r.identifier === 'yellow_cards').points, -1);
  });

  test('red card = -3 pts', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, red_cards: 1 }), 3);
    assert.strictEqual(rows.find(r => r.identifier === 'red_cards').points, -3);
  });
});

describe('buildBreakdown – saves (GK)', () => {
  test('3 saves = 1 pt', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, saves: 3 }), 1);
    assert.strictEqual(rows.find(r => r.identifier === 'saves').points, 1);
  });

  test('6 saves = 2 pts', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, saves: 6 }), 1);
    assert.strictEqual(rows.find(r => r.identifier === 'saves').points, 2);
  });

  test('2 saves produces no row (below threshold)', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, saves: 2 }), 1);
    assert.ok(!rows.find(r => r.identifier === 'saves'));
  });

  test('non-GK saves produce no row', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, saves: 5 }), 4);
    assert.ok(!rows.find(r => r.identifier === 'saves'));
  });
});

describe('buildBreakdown – defensive contribution', () => {
  test('GK/DEF: 10+ contributions = 2 pts', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, defensive_contribution: 10 }), 2);
    assert.strictEqual(rows.find(r => r.identifier === 'defensive_contribution').points, 2);
  });

  test('GK/DEF: < 10 contributions = 0 pts', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, defensive_contribution: 9 }), 2);
    assert.strictEqual(rows.find(r => r.identifier === 'defensive_contribution').points, 0);
  });

  test('MID/FWD: 12+ contributions = 2 pts', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, defensive_contribution: 12 }), 3);
    assert.strictEqual(rows.find(r => r.identifier === 'defensive_contribution').points, 2);
  });

  test('MID/FWD: < 12 contributions = 0 pts', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, defensive_contribution: 11 }), 3);
    assert.strictEqual(rows.find(r => r.identifier === 'defensive_contribution').points, 0);
  });
});

describe('buildBreakdown – bonus', () => {
  test('settled bonus > 0 included with provisional=false', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, bonus: 3 }), 3);
    const row = rows.find(r => r.identifier === 'bonus');
    assert.ok(row);
    assert.strictEqual(row.points, 3);
    assert.strictEqual(row.provisional, false);
  });

  test('settled bonus = 0 produces no bonus row', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, bonus: 0 }), 3);
    assert.ok(!rows.find(r => r.identifier === 'bonus'));
  });

  test('provisionalBonus overrides entry bonus', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, bonus: 0 }), 3, 2);
    const row = rows.find(r => r.identifier === 'bonus');
    assert.ok(row);
    assert.strictEqual(row.value, 2);
    assert.strictEqual(row.points, 2);
    assert.strictEqual(row.provisional, true);
  });

  test('provisionalBonus = 0 produces no bonus row', () => {
    const rows = buildBreakdown(makeEntry({ minutes: 90, bonus: 0 }), 3, 0);
    assert.ok(!rows.find(r => r.identifier === 'bonus'));
  });
});

describe('buildBreakdown – bonus is always last row', () => {
  test('bonus row is the last row when present', () => {
    const entry = makeEntry({ minutes: 90, goals_scored: 1, assists: 1, bonus: 3 });
    const rows = buildBreakdown(entry, 4);
    assert.strictEqual(rows[rows.length - 1].identifier, 'bonus');
  });
});
