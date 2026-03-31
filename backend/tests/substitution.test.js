'use strict';

/**
 * Comprehensive tests for backend/utils/substitution.js
 * Runs with Node.js built-in test runner: node --test
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  POSITION,
  getPosition,
  countPositions,
  isValidFormation,
  getFormationError,
  validateSubstitution,
} = require('../utils/substitution');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _nextCode = 1;
const makePlayer = (overrides) => ({
  code: _nextCode++,
  element_type: POSITION.MID,
  is_captain: false,
  is_vice_captain: false,
  multiplier: 1,
  ...overrides,
});

/**
 * Build a standard 4-3-3 squad (11 main + 4 bench).
 * Returns { mainTeam, benchTeam }.
 */
const makeSquad433 = () => {
  _nextCode = 100;
  const mainTeam = [
    makePlayer({ element_type: POSITION.GK  }),                         // 100
    makePlayer({ element_type: POSITION.DEF }),                         // 101
    makePlayer({ element_type: POSITION.DEF }),                         // 102
    makePlayer({ element_type: POSITION.DEF }),                         // 103
    makePlayer({ element_type: POSITION.DEF }),                         // 104
    makePlayer({ element_type: POSITION.MID }),                         // 105
    makePlayer({ element_type: POSITION.MID }),                         // 106
    makePlayer({ element_type: POSITION.MID }),                         // 107
    makePlayer({ element_type: POSITION.FWD }),                         // 108
    makePlayer({ element_type: POSITION.FWD }),                         // 109
    makePlayer({ element_type: POSITION.FWD }),                         // 110
  ];
  const benchTeam = [
    makePlayer({ element_type: POSITION.GK  }),                         // 111
    makePlayer({ element_type: POSITION.DEF }),                         // 112
    makePlayer({ element_type: POSITION.MID }),                         // 113
    makePlayer({ element_type: POSITION.FWD }),                         // 114
  ];
  return { mainTeam, benchTeam };
};

// ---------------------------------------------------------------------------
// POSITION / getPosition
// ---------------------------------------------------------------------------

describe('getPosition', () => {
  test('reads element_type field', () => {
    assert.equal(getPosition({ element_type: POSITION.GK }), POSITION.GK);
  });

  test('falls back to position field', () => {
    assert.equal(getPosition({ position: POSITION.DEF }), POSITION.DEF);
  });

  test('returns 0 for unknown player', () => {
    assert.equal(getPosition({}), 0);
  });
});

// ---------------------------------------------------------------------------
// countPositions / isValidFormation
// ---------------------------------------------------------------------------

describe('isValidFormation', () => {
  test('accepts a valid 4-3-3 starting XI', () => {
    const { mainTeam } = makeSquad433();
    assert.equal(isValidFormation(mainTeam), true);
  });

  test('accepts a 3-3-4 (3 DEF, 3 MID, 4 FWD)', () => {
    _nextCode = 200;
    const mainTeam = [
      makePlayer({ element_type: POSITION.GK  }),
      makePlayer({ element_type: POSITION.DEF }),
      makePlayer({ element_type: POSITION.DEF }),
      makePlayer({ element_type: POSITION.DEF }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.FWD }),
      makePlayer({ element_type: POSITION.FWD }),
      makePlayer({ element_type: POSITION.FWD }),
      makePlayer({ element_type: POSITION.FWD }),
    ];
    assert.equal(isValidFormation(mainTeam), true);
  });

  test('rejects team with only 2 DEF', () => {
    _nextCode = 300;
    const mainTeam = [
      makePlayer({ element_type: POSITION.GK  }),
      makePlayer({ element_type: POSITION.DEF }),
      makePlayer({ element_type: POSITION.DEF }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.FWD }),
      makePlayer({ element_type: POSITION.FWD }),
      makePlayer({ element_type: POSITION.FWD }),
    ];
    assert.equal(isValidFormation(mainTeam), false);
  });

  test('rejects team with only 2 MID', () => {
    _nextCode = 400;
    const mainTeam = [
      makePlayer({ element_type: POSITION.GK  }),
      makePlayer({ element_type: POSITION.DEF }),
      makePlayer({ element_type: POSITION.DEF }),
      makePlayer({ element_type: POSITION.DEF }),
      makePlayer({ element_type: POSITION.DEF }),
      makePlayer({ element_type: POSITION.DEF }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.FWD }),
      makePlayer({ element_type: POSITION.FWD }),
      makePlayer({ element_type: POSITION.FWD }),
    ];
    assert.equal(isValidFormation(mainTeam), false);
  });

  test('rejects team with 0 FWD', () => {
    _nextCode = 500;
    const mainTeam = [
      makePlayer({ element_type: POSITION.GK  }),
      makePlayer({ element_type: POSITION.DEF }),
      makePlayer({ element_type: POSITION.DEF }),
      makePlayer({ element_type: POSITION.DEF }),
      makePlayer({ element_type: POSITION.DEF }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.MID }),
    ];
    assert.equal(isValidFormation(mainTeam), false);
  });

  test('rejects team with 0 GK', () => {
    _nextCode = 600;
    const mainTeam = Array.from({ length: 11 }, () => makePlayer({ element_type: POSITION.DEF }));
    assert.equal(isValidFormation(mainTeam), false);
  });
});

describe('getFormationError', () => {
  test('returns null for a valid formation', () => {
    const { mainTeam } = makeSquad433();
    assert.equal(getFormationError(mainTeam), null);
  });

  test('identifies insufficient DEF', () => {
    _nextCode = 700;
    const mainTeam = [
      makePlayer({ element_type: POSITION.GK  }),
      makePlayer({ element_type: POSITION.DEF }),
      makePlayer({ element_type: POSITION.DEF }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.FWD }),
      makePlayer({ element_type: POSITION.FWD }),
      makePlayer({ element_type: POSITION.FWD }),
    ];
    assert.match(getFormationError(mainTeam), /defender/i);
  });

  test('identifies insufficient MID', () => {
    _nextCode = 800;
    const mainTeam = [
      makePlayer({ element_type: POSITION.GK  }),
      makePlayer({ element_type: POSITION.DEF }),
      makePlayer({ element_type: POSITION.DEF }),
      makePlayer({ element_type: POSITION.DEF }),
      makePlayer({ element_type: POSITION.DEF }),
      makePlayer({ element_type: POSITION.DEF }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.FWD }),
      makePlayer({ element_type: POSITION.FWD }),
      makePlayer({ element_type: POSITION.FWD }),
    ];
    assert.match(getFormationError(mainTeam), /midfielder/i);
  });

  test('identifies zero FWD', () => {
    _nextCode = 900;
    const mainTeam = [
      makePlayer({ element_type: POSITION.GK  }),
      makePlayer({ element_type: POSITION.DEF }),
      makePlayer({ element_type: POSITION.DEF }),
      makePlayer({ element_type: POSITION.DEF }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.MID }),
    ];
    assert.match(getFormationError(mainTeam), /forward/i);
  });
});

// ---------------------------------------------------------------------------
// validateSubstitution
// ---------------------------------------------------------------------------

describe('validateSubstitution — zone rules', () => {
  test('rejects main-main swap (same zone)', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const r = validateSubstitution(mainTeam[1], mainTeam[2], 'main', 'main', mainTeam, benchTeam);
    assert.equal(r.valid, false);
    assert.match(r.error, /bench/i);
  });

  test('rejects bench-bench swap (same zone)', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const r = validateSubstitution(benchTeam[0], benchTeam[1], 'bench', 'bench', mainTeam, benchTeam);
    assert.equal(r.valid, false);
  });
});

describe('validateSubstitution — GK rule', () => {
  test('allows GK ↔ GK swap', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const mainGK  = mainTeam.find(p => p.element_type === POSITION.GK);
    const benchGK = benchTeam.find(p => p.element_type === POSITION.GK);
    const r = validateSubstitution(mainGK, benchGK, 'main', 'bench', mainTeam, benchTeam);
    assert.equal(r.valid, true);
  });

  test('rejects GK ↔ DEF swap', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const mainGK   = mainTeam.find(p => p.element_type === POSITION.GK);
    const benchDEF = benchTeam.find(p => p.element_type === POSITION.DEF);
    const r = validateSubstitution(mainGK, benchDEF, 'main', 'bench', mainTeam, benchTeam);
    assert.equal(r.valid, false);
    assert.match(r.error, /goalkeeper/i);
  });

  test('rejects DEF ↔ GK swap', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const mainDEF  = mainTeam.find(p => p.element_type === POSITION.DEF);
    const benchGK  = benchTeam.find(p => p.element_type === POSITION.GK);
    const r = validateSubstitution(mainDEF, benchGK, 'main', 'bench', mainTeam, benchTeam);
    assert.equal(r.valid, false);
    assert.match(r.error, /goalkeeper/i);
  });
});

describe('validateSubstitution — same-position swaps', () => {
  test('allows DEF ↔ DEF swap', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const mainDEF  = mainTeam.find(p => p.element_type === POSITION.DEF);
    const benchDEF = benchTeam.find(p => p.element_type === POSITION.DEF);
    const r = validateSubstitution(mainDEF, benchDEF, 'main', 'bench', mainTeam, benchTeam);
    assert.equal(r.valid, true);
  });

  test('allows MID ↔ MID swap', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const mainMID  = mainTeam.find(p => p.element_type === POSITION.MID);
    const benchMID = benchTeam.find(p => p.element_type === POSITION.MID);
    const r = validateSubstitution(mainMID, benchMID, 'main', 'bench', mainTeam, benchTeam);
    assert.equal(r.valid, true);
  });

  test('allows FWD ↔ FWD swap', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const mainFWD  = mainTeam.find(p => p.element_type === POSITION.FWD);
    const benchFWD = benchTeam.find(p => p.element_type === POSITION.FWD);
    const r = validateSubstitution(mainFWD, benchFWD, 'main', 'bench', mainTeam, benchTeam);
    assert.equal(r.valid, true);
  });
});

describe('validateSubstitution — cross-position swaps', () => {
  test('allows MID ↔ FWD swap when formation stays valid (4-3-3 → 4-2-4 violates MID min ⟹ should reject)', () => {
    // The 4-3-3 squad has 3 MIDs; swapping the only spare MID for a FWD drops
    // MID to 2, which violates the ≥3 MID rule.
    const { mainTeam, benchTeam } = makeSquad433();
    const mainMID  = mainTeam.find(p => p.element_type === POSITION.MID);
    const benchFWD = benchTeam.find(p => p.element_type === POSITION.FWD);
    const r = validateSubstitution(mainMID, benchFWD, 'main', 'bench', mainTeam, benchTeam);
    assert.equal(r.valid, false);
    assert.match(r.error, /midfielder/i);
  });

  test('allows DEF ↔ MID swap when DEF stays ≥3', () => {
    // 4-3-3 → sub one DEF for bench MID → 3 DEF, 4 MID, 3 FWD — still valid
    const { mainTeam, benchTeam } = makeSquad433();
    const mainDEF  = mainTeam.find(p => p.element_type === POSITION.DEF);
    const benchMID = benchTeam.find(p => p.element_type === POSITION.MID);
    const r = validateSubstitution(mainDEF, benchMID, 'main', 'bench', mainTeam, benchTeam);
    assert.equal(r.valid, true);
  });

  test('rejects DEF ↔ MID swap when result has only 2 DEF', () => {
    // Build a 3-3-4 squad with exactly 3 DEF in main; removing one → 2 DEF = invalid.
    _nextCode = 1000;
    const mainTeam = [
      makePlayer({ element_type: POSITION.GK  }),
      makePlayer({ element_type: POSITION.DEF }),
      makePlayer({ element_type: POSITION.DEF }),
      makePlayer({ element_type: POSITION.DEF }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.FWD }),
      makePlayer({ element_type: POSITION.FWD }),
      makePlayer({ element_type: POSITION.FWD }),
      makePlayer({ element_type: POSITION.FWD }),
    ];
    const benchTeam = [
      makePlayer({ element_type: POSITION.GK  }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.MID }),
      makePlayer({ element_type: POSITION.FWD }),
    ];
    const mainDEF  = mainTeam.find(p => p.element_type === POSITION.DEF);
    const benchMID = benchTeam.find(p => p.element_type === POSITION.MID);
    const r = validateSubstitution(mainDEF, benchMID, 'main', 'bench', mainTeam, benchTeam);
    assert.equal(r.valid, false);
    assert.match(r.error, /defender/i);
  });
});

describe('validateSubstitution — player not found', () => {
  test('rejects when player not in stated zone', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const mainMID  = mainTeam.find(p => p.element_type === POSITION.MID);
    const benchFWD = benchTeam.find(p => p.element_type === POSITION.FWD);
    // Claim both are on bench — idx1 will be -1 since mainMID isn't on bench
    const r = validateSubstitution(mainMID, benchFWD, 'bench', 'bench', mainTeam, benchTeam);
    // Same zone → rejected before player lookup
    assert.equal(r.valid, false);
  });

  test('rejects player not present in team arrays', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const stranger = makePlayer({ element_type: POSITION.MID });
    const benchMID = benchTeam.find(p => p.element_type === POSITION.MID);
    const r = validateSubstitution(stranger, benchMID, 'main', 'bench', mainTeam, benchTeam);
    assert.equal(r.valid, false);
    assert.match(r.error, /not found/i);
  });
});

describe('validateSubstitution — manager rule', () => {
  test('allows manager ↔ manager swap', () => {
    _nextCode = 1100;
    const mgr1 = makePlayer({ element_type: POSITION.MANAGER });
    const mgr2 = makePlayer({ element_type: POSITION.MANAGER });
    const mainTeam = [mgr1];
    const benchTeam = [mgr2];
    const r = validateSubstitution(mgr1, mgr2, 'main', 'bench', mainTeam, benchTeam);
    assert.equal(r.valid, true);
  });

  test('rejects manager ↔ outfield swap', () => {
    _nextCode = 1200;
    const mgr = makePlayer({ element_type: POSITION.MANAGER });
    const { mainTeam, benchTeam } = makeSquad433();
    mainTeam.push(mgr);
    const r = validateSubstitution(mgr, benchTeam[1], 'main', 'bench', mainTeam, benchTeam);
    assert.equal(r.valid, false);
    assert.match(r.error, /manager/i);
  });
});

// ---------------------------------------------------------------------------
// Regression — sequential substitutions
// ---------------------------------------------------------------------------

describe('sequential substitutions do not corrupt team', () => {
  test('two consecutive valid swaps preserve 11 starters and valid formation', () => {
    let { mainTeam, benchTeam } = makeSquad433();

    // Swap 1: main DEF ↔ bench DEF
    const mainDEF  = mainTeam.find(p => p.element_type === POSITION.DEF);
    const benchDEF = benchTeam.find(p => p.element_type === POSITION.DEF);
    const r1 = validateSubstitution(mainDEF, benchDEF, 'main', 'bench', mainTeam, benchTeam);
    assert.equal(r1.valid, true);

    // Apply by mutating copies (mirrors what applySubstitution does)
    const newMain1 = [...mainTeam];
    const newBench1 = [...benchTeam];
    const i1 = newMain1.findIndex(p => p.code === mainDEF.code);
    const i2 = newBench1.findIndex(p => p.code === benchDEF.code);
    [newMain1[i1], newBench1[i2]] = [newBench1[i2], newMain1[i1]];
    mainTeam = newMain1;
    benchTeam = newBench1;

    assert.equal(mainTeam.length, 11);
    assert.equal(isValidFormation(mainTeam), true);

    // Swap 2: main GK ↔ bench GK
    const mainGK  = mainTeam.find(p => p.element_type === POSITION.GK);
    const benchGK = benchTeam.find(p => p.element_type === POSITION.GK);
    const r2 = validateSubstitution(mainGK, benchGK, 'main', 'bench', mainTeam, benchTeam);
    assert.equal(r2.valid, true);

    const newMain2 = [...mainTeam];
    const newBench2 = [...benchTeam];
    const j1 = newMain2.findIndex(p => p.code === mainGK.code);
    const j2 = newBench2.findIndex(p => p.code === benchGK.code);
    [newMain2[j1], newBench2[j2]] = [newBench2[j2], newMain2[j1]];

    assert.equal(newMain2.length, 11);
    assert.equal(isValidFormation(newMain2), true);
    assert.equal(newBench2.length, 4);
  });
});

// ---------------------------------------------------------------------------
// Property-based / fuzz
// ---------------------------------------------------------------------------

describe('property-based fuzz tests', () => {
  /**
   * Generate a random valid squad.
   * Formations: pick a random number of DEF (3-5), MID (3-5), FWD (1-3) such
   * that outfield sums to 10.  Fill bench with 1 GK + 3 outfield of any type.
   */
  const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

  const randomValidFormation = () => {
    const nDef = randomInt(3, 5);
    const nFwd = randomInt(1, Math.min(3, 10 - nDef - 3)); // leave room for MID
    const nMid = 10 - nDef - nFwd;
    return { nDef, nMid, nFwd };
  };

  const buildRandomSquad = () => {
    _nextCode = 2000 + randomInt(0, 500);
    const { nDef, nMid, nFwd } = randomValidFormation();
    const mainTeam = [
      makePlayer({ element_type: POSITION.GK }),
      ...Array.from({ length: nDef }, () => makePlayer({ element_type: POSITION.DEF })),
      ...Array.from({ length: nMid }, () => makePlayer({ element_type: POSITION.MID })),
      ...Array.from({ length: nFwd }, () => makePlayer({ element_type: POSITION.FWD })),
    ];
    const benchTeam = [
      makePlayer({ element_type: POSITION.GK }),
      makePlayer({ element_type: [POSITION.DEF, POSITION.MID, POSITION.FWD][randomInt(0, 2)] }),
      makePlayer({ element_type: [POSITION.DEF, POSITION.MID, POSITION.FWD][randomInt(0, 2)] }),
      makePlayer({ element_type: [POSITION.DEF, POSITION.MID, POSITION.FWD][randomInt(0, 2)] }),
    ];
    return { mainTeam, benchTeam };
  };

  test('random valid squads always satisfy isValidFormation', () => {
    for (let i = 0; i < 50; i++) {
      const { mainTeam } = buildRandomSquad();
      assert.equal(
        isValidFormation(mainTeam),
        true,
        `Formation invalid for squad: ${JSON.stringify(mainTeam.map(p => p.element_type))}`
      );
    }
  });

  test('valid GK swap never corrupts formation', () => {
    for (let i = 0; i < 30; i++) {
      const { mainTeam, benchTeam } = buildRandomSquad();
      const mainGK  = mainTeam.find(p => p.element_type === POSITION.GK);
      const benchGK = benchTeam.find(p => p.element_type === POSITION.GK);
      const result = validateSubstitution(mainGK, benchGK, 'main', 'bench', mainTeam, benchTeam);
      assert.equal(result.valid, true, 'GK swap should always be valid');

      // Apply the swap and verify.
      const newMain = [...mainTeam];
      const newBench = [...benchTeam];
      const i1 = newMain.findIndex(p => p.code === mainGK.code);
      const i2 = newBench.findIndex(p => p.code === benchGK.code);
      [newMain[i1], newBench[i2]] = [newBench[i2], newMain[i1]];
      assert.equal(isValidFormation(newMain), true);
      assert.equal(newMain.length, 11);
      assert.equal(newBench.length, 4);
    }
  });

  test('no duplicate player codes exist in any generated squad', () => {
    for (let i = 0; i < 50; i++) {
      const { mainTeam, benchTeam } = buildRandomSquad();
      const all = [...mainTeam, ...benchTeam];
      const codes = all.map(p => p.code);
      const unique = new Set(codes);
      assert.equal(unique.size, all.length, 'Duplicate player codes detected');
    }
  });
});
