/**
 * Comprehensive tests for frontend/src/utils/substitution.js
 * Runs with: vitest (already configured in frontend/package.json)
 */

import { describe, it, expect } from 'vitest';
import {
  POSITION,
  countPositions,
  isValidFormation,
  validateSubstitution,
  applySubstitution,
  calculateScore,
  normalizeCaptaincy,
} from './substitution';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _code = 1;
const makePlayer = (overrides = {}) => ({
  code: _code++,
  position: POSITION.MID,
  predictedPoints: 5,
  basePoints: 5,
  multiplier: 1,
  is_captain: false,
  is_vice_captain: false,
  ...overrides,
});

/**
 * Build a standard 4-3-3 squad (11 main, 4 bench).
 * Returns { mainTeam, benchTeam }.
 */
const makeSquad433 = () => {
  _code = 100;
  const mainTeam = [
    makePlayer({ position: POSITION.GK,  code: 100, predictedPoints: 5, basePoints: 5 }),
    makePlayer({ position: POSITION.DEF, code: 101, predictedPoints: 6, basePoints: 6 }),
    makePlayer({ position: POSITION.DEF, code: 102, predictedPoints: 6, basePoints: 6 }),
    makePlayer({ position: POSITION.DEF, code: 103, predictedPoints: 6, basePoints: 6 }),
    makePlayer({ position: POSITION.DEF, code: 104, predictedPoints: 6, basePoints: 6 }),
    makePlayer({ position: POSITION.MID, code: 105, predictedPoints: 7, basePoints: 7 }),
    makePlayer({ position: POSITION.MID, code: 106, predictedPoints: 7, basePoints: 7 }),
    makePlayer({ position: POSITION.MID, code: 107, predictedPoints: 14, basePoints: 7, is_captain: true, multiplier: 2 }),
    makePlayer({ position: POSITION.FWD, code: 108, predictedPoints: 8, basePoints: 8, is_vice_captain: true }),
    makePlayer({ position: POSITION.FWD, code: 109, predictedPoints: 8, basePoints: 8 }),
    makePlayer({ position: POSITION.FWD, code: 110, predictedPoints: 8, basePoints: 8 }),
  ];
  const benchTeam = [
    makePlayer({ position: POSITION.GK,  code: 111, predictedPoints: 3, basePoints: 3 }),
    makePlayer({ position: POSITION.DEF, code: 112, predictedPoints: 4, basePoints: 4 }),
    makePlayer({ position: POSITION.MID, code: 113, predictedPoints: 4, basePoints: 4 }),
    makePlayer({ position: POSITION.FWD, code: 114, predictedPoints: 4, basePoints: 4 }),
  ];
  return { mainTeam, benchTeam };
};

// ---------------------------------------------------------------------------
// countPositions
// ---------------------------------------------------------------------------

describe('countPositions', () => {
  it('correctly tallies a 4-3-3', () => {
    const { mainTeam } = makeSquad433();
    const counts = countPositions(mainTeam);
    expect(counts[POSITION.GK]).toBe(1);
    expect(counts[POSITION.DEF]).toBe(4);
    expect(counts[POSITION.MID]).toBe(3);
    expect(counts[POSITION.FWD]).toBe(3);
  });

  it('ignores manager slots', () => {
    const team = [makePlayer({ position: POSITION.MANAGER })];
    const counts = countPositions(team);
    expect(counts[POSITION.GK]).toBe(0);
    expect(counts[POSITION.DEF]).toBe(0);
    expect(counts[POSITION.MID]).toBe(0);
    expect(counts[POSITION.FWD]).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// isValidFormation
// ---------------------------------------------------------------------------

describe('isValidFormation', () => {
  it('accepts a valid 4-3-3', () => {
    const { mainTeam } = makeSquad433();
    expect(isValidFormation(mainTeam)).toBe(true);
  });

  it('accepts a 5-3-2 (max DEF, min FWD)', () => {
    _code = 200;
    const mainTeam = [
      makePlayer({ position: POSITION.GK  }),
      makePlayer({ position: POSITION.DEF }),
      makePlayer({ position: POSITION.DEF }),
      makePlayer({ position: POSITION.DEF }),
      makePlayer({ position: POSITION.DEF }),
      makePlayer({ position: POSITION.DEF }),
      makePlayer({ position: POSITION.MID }),
      makePlayer({ position: POSITION.MID }),
      makePlayer({ position: POSITION.MID }),
      makePlayer({ position: POSITION.FWD }),
      makePlayer({ position: POSITION.FWD }),
    ];
    expect(isValidFormation(mainTeam)).toBe(true);
  });

  it('rejects exactly 2 DEF', () => {
    _code = 300;
    const mainTeam = [
      makePlayer({ position: POSITION.GK  }),
      makePlayer({ position: POSITION.DEF }),
      makePlayer({ position: POSITION.DEF }),
      makePlayer({ position: POSITION.MID }),
      makePlayer({ position: POSITION.MID }),
      makePlayer({ position: POSITION.MID }),
      makePlayer({ position: POSITION.MID }),
      makePlayer({ position: POSITION.MID }),
      makePlayer({ position: POSITION.FWD }),
      makePlayer({ position: POSITION.FWD }),
      makePlayer({ position: POSITION.FWD }),
    ];
    expect(isValidFormation(mainTeam)).toBe(false);
  });

  it('rejects exactly 2 MID', () => {
    _code = 400;
    const mainTeam = [
      makePlayer({ position: POSITION.GK  }),
      makePlayer({ position: POSITION.DEF }),
      makePlayer({ position: POSITION.DEF }),
      makePlayer({ position: POSITION.DEF }),
      makePlayer({ position: POSITION.DEF }),
      makePlayer({ position: POSITION.DEF }),
      makePlayer({ position: POSITION.MID }),
      makePlayer({ position: POSITION.MID }),
      makePlayer({ position: POSITION.FWD }),
      makePlayer({ position: POSITION.FWD }),
      makePlayer({ position: POSITION.FWD }),
    ];
    expect(isValidFormation(mainTeam)).toBe(false);
  });

  it('rejects 0 FWD', () => {
    _code = 500;
    const mainTeam = [
      makePlayer({ position: POSITION.GK  }),
      ...Array.from({ length: 5 }, () => makePlayer({ position: POSITION.DEF })),
      ...Array.from({ length: 5 }, () => makePlayer({ position: POSITION.MID })),
    ];
    expect(isValidFormation(mainTeam)).toBe(false);
  });

  it('rejects 0 GK', () => {
    _code = 600;
    const mainTeam = Array.from({ length: 11 }, () => makePlayer({ position: POSITION.DEF }));
    expect(isValidFormation(mainTeam)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateSubstitution — zone enforcement
// ---------------------------------------------------------------------------

describe('validateSubstitution — zone rules', () => {
  it('rejects main-main swap', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const r = validateSubstitution(mainTeam[1], mainTeam[2], 'main', 'main', mainTeam, benchTeam);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/bench/i);
  });

  it('rejects bench-bench swap', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const r = validateSubstitution(benchTeam[0], benchTeam[1], 'bench', 'bench', mainTeam, benchTeam);
    expect(r.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateSubstitution — GK rule
// ---------------------------------------------------------------------------

describe('validateSubstitution — GK rule (GK can only swap with GK)', () => {
  it('allows GK ↔ GK swap', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const mainGK  = mainTeam.find(p => p.position === POSITION.GK);
    const benchGK = benchTeam.find(p => p.position === POSITION.GK);
    const r = validateSubstitution(mainGK, benchGK, 'main', 'bench', mainTeam, benchTeam);
    expect(r.valid).toBe(true);
  });

  it('rejects GK ↔ DEF swap', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const mainGK   = mainTeam.find(p => p.position === POSITION.GK);
    const benchDEF = benchTeam.find(p => p.position === POSITION.DEF);
    const r = validateSubstitution(mainGK, benchDEF, 'main', 'bench', mainTeam, benchTeam);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/goalkeeper/i);
  });

  it('rejects DEF ↔ GK swap (bench GK coming in)', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const mainDEF = mainTeam.find(p => p.position === POSITION.DEF);
    const benchGK = benchTeam.find(p => p.position === POSITION.GK);
    const r = validateSubstitution(mainDEF, benchGK, 'main', 'bench', mainTeam, benchTeam);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/goalkeeper/i);
  });

  it('rejects GK ↔ FWD swap', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const mainGK   = mainTeam.find(p => p.position === POSITION.GK);
    const benchFWD = benchTeam.find(p => p.position === POSITION.FWD);
    const r = validateSubstitution(mainGK, benchFWD, 'main', 'bench', mainTeam, benchTeam);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/goalkeeper/i);
  });
});

// ---------------------------------------------------------------------------
// validateSubstitution — same-position cross-zone
// ---------------------------------------------------------------------------

describe('validateSubstitution — same-position valid swaps', () => {
  it('allows DEF ↔ DEF swap', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const mainDEF  = mainTeam.find(p => p.position === POSITION.DEF);
    const benchDEF = benchTeam.find(p => p.position === POSITION.DEF);
    const r = validateSubstitution(mainDEF, benchDEF, 'main', 'bench', mainTeam, benchTeam);
    expect(r.valid).toBe(true);
  });

  it('allows MID ↔ MID swap', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const mainMID  = mainTeam.find(p => p.position === POSITION.MID);
    const benchMID = benchTeam.find(p => p.position === POSITION.MID);
    const r = validateSubstitution(mainMID, benchMID, 'main', 'bench', mainTeam, benchTeam);
    expect(r.valid).toBe(true);
  });

  it('allows FWD ↔ FWD swap', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const mainFWD  = mainTeam.find(p => p.position === POSITION.FWD);
    const benchFWD = benchTeam.find(p => p.position === POSITION.FWD);
    const r = validateSubstitution(mainFWD, benchFWD, 'main', 'bench', mainTeam, benchTeam);
    expect(r.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateSubstitution — cross-position formation checks
// ---------------------------------------------------------------------------

describe('validateSubstitution — cross-position formation enforcement', () => {
  it('rejects MID ↔ FWD swap when it would drop MID below minimum', () => {
    // 4-3-3: removing any MID → 2 MID violates minimum
    const { mainTeam, benchTeam } = makeSquad433();
    const mainMID  = mainTeam.find(p => p.position === POSITION.MID && !p.is_captain);
    const benchFWD = benchTeam.find(p => p.position === POSITION.FWD);
    const r = validateSubstitution(mainMID, benchFWD, 'main', 'bench', mainTeam, benchTeam);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/midfielder/i);
  });

  it('allows DEF ↔ MID swap when DEF stays ≥ 3', () => {
    // 4-3-3: remove one DEF, add bench MID → 3 DEF, 4 MID, 3 FWD (valid)
    const { mainTeam, benchTeam } = makeSquad433();
    const mainDEF  = mainTeam.find(p => p.position === POSITION.DEF);
    const benchMID = benchTeam.find(p => p.position === POSITION.MID);
    const r = validateSubstitution(mainDEF, benchMID, 'main', 'bench', mainTeam, benchTeam);
    expect(r.valid).toBe(true);
  });

  it('rejects DEF ↔ MID swap when it would drop DEF below 3', () => {
    // Build 3-3-4 (minimum DEF); removing one DEF → 2 DEF
    _code = 1000;
    const mainTeam = [
      makePlayer({ position: POSITION.GK  }),
      makePlayer({ position: POSITION.DEF }),
      makePlayer({ position: POSITION.DEF }),
      makePlayer({ position: POSITION.DEF }),
      makePlayer({ position: POSITION.MID }),
      makePlayer({ position: POSITION.MID }),
      makePlayer({ position: POSITION.MID }),
      makePlayer({ position: POSITION.FWD }),
      makePlayer({ position: POSITION.FWD }),
      makePlayer({ position: POSITION.FWD }),
      makePlayer({ position: POSITION.FWD }),
    ];
    const benchTeam = [
      makePlayer({ position: POSITION.GK  }),
      makePlayer({ position: POSITION.MID }),
      makePlayer({ position: POSITION.MID }),
      makePlayer({ position: POSITION.FWD }),
    ];
    const mainDEF  = mainTeam.find(p => p.position === POSITION.DEF);
    const benchMID = benchTeam.find(p => p.position === POSITION.MID);
    const r = validateSubstitution(mainDEF, benchMID, 'main', 'bench', mainTeam, benchTeam);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/defender/i);
  });

  it('rejects FWD ↔ MID swap when it would drop FWD below 1', () => {
    _code = 1100;
    const mainTeam = [
      makePlayer({ position: POSITION.GK  }),
      makePlayer({ position: POSITION.DEF }),
      makePlayer({ position: POSITION.DEF }),
      makePlayer({ position: POSITION.DEF }),
      makePlayer({ position: POSITION.DEF }),
      makePlayer({ position: POSITION.MID }),
      makePlayer({ position: POSITION.MID }),
      makePlayer({ position: POSITION.MID }),
      makePlayer({ position: POSITION.MID }),
      makePlayer({ position: POSITION.MID }),
      makePlayer({ position: POSITION.FWD }),
    ];
    const benchTeam = [
      makePlayer({ position: POSITION.GK  }),
      makePlayer({ position: POSITION.MID }),
      makePlayer({ position: POSITION.DEF }),
      makePlayer({ position: POSITION.DEF }),
    ];
    const mainFWD  = mainTeam.find(p => p.position === POSITION.FWD);
    const benchMID = benchTeam.find(p => p.position === POSITION.MID);
    const r = validateSubstitution(mainFWD, benchMID, 'main', 'bench', mainTeam, benchTeam);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/forward/i);
  });
});

// ---------------------------------------------------------------------------
// validateSubstitution — player not found
// ---------------------------------------------------------------------------

describe('validateSubstitution — player not found', () => {
  it('rejects when player is not in the stated zone', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    _code = 9999;
    const stranger = makePlayer({ position: POSITION.MID });
    const benchMID = benchTeam.find(p => p.position === POSITION.MID);
    const r = validateSubstitution(stranger, benchMID, 'main', 'bench', mainTeam, benchTeam);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/not found/i);
  });
});

// ---------------------------------------------------------------------------
// applySubstitution — position slot preservation
// ---------------------------------------------------------------------------

describe('applySubstitution — slot preservation', () => {
  it('incoming player occupies the exact slot of the outgoing player', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const mainDEF  = mainTeam.find(p => p.position === POSITION.DEF);
    const benchDEF = benchTeam.find(p => p.position === POSITION.DEF);
    const slotIndex = mainTeam.indexOf(mainDEF);

    const { mainTeam: newMain } = applySubstitution(
      mainTeam, benchTeam, mainDEF, benchDEF, 'main', 'bench'
    );

    expect(newMain[slotIndex].code).toBe(benchDEF.code);
  });

  it('outgoing player occupies the exact bench slot of the incoming player', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const mainDEF  = mainTeam.find(p => p.position === POSITION.DEF);
    const benchDEF = benchTeam.find(p => p.position === POSITION.DEF);
    const benchSlot = benchTeam.indexOf(benchDEF);

    const { benchTeam: newBench } = applySubstitution(
      mainTeam, benchTeam, mainDEF, benchDEF, 'main', 'bench'
    );

    expect(newBench[benchSlot].code).toBe(mainDEF.code);
  });

  it('does not change the order of players not involved in the swap', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const mainGK  = mainTeam.find(p => p.position === POSITION.GK);
    const benchGK = benchTeam.find(p => p.position === POSITION.GK);

    const { mainTeam: newMain } = applySubstitution(
      mainTeam, benchTeam, mainGK, benchGK, 'main', 'bench'
    );

    // All other main team players should be in the same slots.
    mainTeam.forEach((p, idx) => {
      if (p.code !== mainGK.code) {
        expect(newMain[idx].code).toBe(p.code);
      }
    });
  });

  it('does not mutate the original arrays', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const snapshot = mainTeam.map(p => p.code);
    const mainDEF  = mainTeam.find(p => p.position === POSITION.DEF);
    const benchDEF = benchTeam.find(p => p.position === POSITION.DEF);

    applySubstitution(mainTeam, benchTeam, mainDEF, benchDEF, 'main', 'bench');

    expect(mainTeam.map(p => p.code)).toEqual(snapshot);
  });
});

// ---------------------------------------------------------------------------
// applySubstitution — captain transfer
// ---------------------------------------------------------------------------

describe('applySubstitution — captain logic', () => {
  it('incoming player becomes captain when captain is substituted off', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const captain  = mainTeam.find(p => p.is_captain);
    const benchMID = benchTeam.find(p => p.position === POSITION.MID);

    const { mainTeam: newMain, benchTeam: newBench } = applySubstitution(
      mainTeam, benchTeam, captain, benchMID, 'main', 'bench'
    );

    // Incoming player (was benchMID) is now in the starting XI and is captain.
    const incomingInMain = newMain.find(p => p.code === benchMID.code);
    expect(incomingInMain).toBeDefined();
    expect(incomingInMain.is_captain).toBe(true);
    expect(incomingInMain.multiplier).toBe(2);
    expect(incomingInMain.predictedPoints).toBe(benchMID.basePoints * 2);

    // The old captain is now on the bench without captaincy.
    const oldCaptainOnBench = newBench.find(p => p.code === captain.code);
    expect(oldCaptainOnBench).toBeDefined();
    expect(oldCaptainOnBench.is_captain).toBe(false);
    expect(oldCaptainOnBench.multiplier).toBe(1);
  });

  it('captain is never left on the bench after the swap', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const captain  = mainTeam.find(p => p.is_captain);
    const benchFWD = benchTeam.find(p => p.position === POSITION.FWD);

    // We need a valid swap - captain is MID, bench is FWD. In 4-3-3 this removes
    // a MID making 2 MID which is invalid. Use bench MID instead.
    const benchMID = benchTeam.find(p => p.position === POSITION.MID);
    const { benchTeam: newBench } = applySubstitution(
      mainTeam, benchTeam, captain, benchMID, 'main', 'bench'
    );

    const captainOnBench = newBench.some(p => p.is_captain);
    expect(captainOnBench).toBe(false);
  });

  it('non-captain swap leaves captaincy unchanged', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const captainCode = mainTeam.find(p => p.is_captain).code;
    const mainDEF  = mainTeam.find(p => p.position === POSITION.DEF);
    const benchDEF = benchTeam.find(p => p.position === POSITION.DEF);

    const { mainTeam: newMain } = applySubstitution(
      mainTeam, benchTeam, mainDEF, benchDEF, 'main', 'bench'
    );

    const newCaptain = newMain.find(p => p.is_captain);
    expect(newCaptain).toBeDefined();
    expect(newCaptain.code).toBe(captainCode);
  });
});

// ---------------------------------------------------------------------------
// applySubstitution — vice-captain transfer
// ---------------------------------------------------------------------------

describe('applySubstitution — vice-captain logic', () => {
  it('incoming player becomes vice when vice-captain is substituted off', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const vice     = mainTeam.find(p => p.is_vice_captain && !p.is_captain);
    const benchDEF = benchTeam.find(p => p.position === POSITION.DEF);

    // vice is a FWD; swap for bench DEF — 4-3-3 → 3 DEF+1 DEF back = valid (4 DEF, 3 MID, 2 FWD)
    // Actually need to check this is valid. Let's just use bench FWD.
    const benchFWD = benchTeam.find(p => p.position === POSITION.FWD);
    const { mainTeam: newMain, benchTeam: newBench } = applySubstitution(
      mainTeam, benchTeam, vice, benchFWD, 'main', 'bench'
    );

    const incomingInMain = newMain.find(p => p.code === benchFWD.code);
    expect(incomingInMain.is_vice_captain).toBe(true);

    const oldViceOnBench = newBench.find(p => p.code === vice.code);
    expect(oldViceOnBench.is_vice_captain).toBe(false);
  });

  it('vice-captain is never on bench after the swap', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const vice    = mainTeam.find(p => p.is_vice_captain && !p.is_captain);
    const benchFWD = benchTeam.find(p => p.position === POSITION.FWD);

    const { benchTeam: newBench } = applySubstitution(
      mainTeam, benchTeam, vice, benchFWD, 'main', 'bench'
    );

    const viceOnBench = newBench.some(p => p.is_vice_captain);
    expect(viceOnBench).toBe(false);
  });

  it('non-vice swap leaves vice-captain unchanged', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const viceCode = mainTeam.find(p => p.is_vice_captain).code;
    const mainDEF  = mainTeam.find(p => p.position === POSITION.DEF);
    const benchDEF = benchTeam.find(p => p.position === POSITION.DEF);

    const { mainTeam: newMain } = applySubstitution(
      mainTeam, benchTeam, mainDEF, benchDEF, 'main', 'bench'
    );

    const newVice = newMain.find(p => p.is_vice_captain);
    expect(newVice).toBeDefined();
    expect(newVice.code).toBe(viceCode);
  });
});

// ---------------------------------------------------------------------------
// calculateScore
// ---------------------------------------------------------------------------

describe('calculateScore', () => {
  it('sums starting XI predictedPoints as totalPoints', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const expected = mainTeam.reduce((s, p) => s + p.predictedPoints, 0);
    const { totalPoints } = calculateScore(mainTeam, benchTeam);
    expect(totalPoints).toBe(expected);
  });

  it('sums bench predictedPoints as benchPoints', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const expected = benchTeam.reduce((s, p) => s + p.predictedPoints, 0);
    const { benchPoints } = calculateScore(mainTeam, benchTeam);
    expect(benchPoints).toBe(expected);
  });

  it('bench points do not affect totalPoints', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const { totalPoints } = calculateScore(mainTeam, benchTeam);
    const mainOnly = mainTeam.reduce((s, p) => s + p.predictedPoints, 0);
    expect(totalPoints).toBe(mainOnly);
  });

  it('captain doubling is reflected in totalPoints (already baked into predictedPoints)', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const captain = mainTeam.find(p => p.is_captain);
    // Captain has predictedPoints = basePoints * 2
    expect(captain.predictedPoints).toBe(captain.basePoints * 2);
    const { totalPoints } = calculateScore(mainTeam, benchTeam);
    // Removing captain and adding base confirms the doubling is included
    const withoutCaptain = mainTeam.filter(p => !p.is_captain).reduce((s, p) => s + p.predictedPoints, 0);
    expect(totalPoints).toBe(withoutCaptain + captain.predictedPoints);
  });

  it('score recalculates correctly after a substitution', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const mainDEF  = mainTeam.find(p => p.position === POSITION.DEF);
    const benchDEF = benchTeam.find(p => p.position === POSITION.DEF);

    const { mainTeam: newMain, benchTeam: newBench } = applySubstitution(
      mainTeam, benchTeam, mainDEF, benchDEF, 'main', 'bench'
    );

    const { totalPoints: before } = calculateScore(mainTeam, benchTeam);
    const { totalPoints: after  } = calculateScore(newMain, newBench);

    // Difference = benchDEF.predictedPoints - mainDEF.predictedPoints
    const delta = benchDEF.predictedPoints - mainDEF.predictedPoints;
    expect(after - before).toBe(delta);
  });
});

// ---------------------------------------------------------------------------
// normalizeCaptaincy
// ---------------------------------------------------------------------------

describe('normalizeCaptaincy', () => {
  it('is a no-op when captain is already in starting XI', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const { mainTeam: newMain } = normalizeCaptaincy(mainTeam, benchTeam);
    const cap = newMain.find(p => p.is_captain);
    expect(cap).toBeDefined();
    expect(mainTeam.find(p => p.is_captain).code).toBe(cap.code);
  });

  it('promotes vice-captain to captain when captain is on bench', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    // Corrupt state: move captain to bench without proper transfer
    const captainIdx = mainTeam.findIndex(p => p.is_captain);
    const captain = mainTeam[captainIdx];
    const corruptedMain  = mainTeam.map((p, i) => i === captainIdx ? { ...p, is_captain: false } : p);
    const corruptedBench = [...benchTeam, { ...captain, is_captain: true }];

    const { mainTeam: fixed } = normalizeCaptaincy(corruptedMain, corruptedBench);

    // The vice-captain should now be the captain.
    const viceCode = corruptedMain.find(p => p.is_vice_captain).code;
    const newCap = fixed.find(p => p.is_captain);
    expect(newCap).toBeDefined();
    expect(newCap.code).toBe(viceCode);
    expect(newCap.multiplier).toBe(2);
  });

  it('strips captain from bench when normalizing', () => {
    const { mainTeam, benchTeam } = makeSquad433();
    const captainIdx = mainTeam.findIndex(p => p.is_captain);
    const captain = mainTeam[captainIdx];
    const corruptedMain  = mainTeam.map((p, i) => i === captainIdx ? { ...p, is_captain: false } : p);
    const corruptedBench = [...benchTeam, { ...captain, is_captain: true }];

    const { benchTeam: fixedBench } = normalizeCaptaincy(corruptedMain, corruptedBench);
    expect(fixedBench.some(p => p.is_captain)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Regression: sequential substitutions
// ---------------------------------------------------------------------------

describe('sequential substitutions — regression coverage', () => {
  it('two consecutive valid swaps preserve 11 starters and a valid formation', () => {
    let { mainTeam, benchTeam } = makeSquad433();

    // Swap 1: main DEF ↔ bench DEF
    const def1 = mainTeam.find(p => p.position === POSITION.DEF);
    const bDef = benchTeam.find(p => p.position === POSITION.DEF);
    ({ mainTeam, benchTeam } = applySubstitution(mainTeam, benchTeam, def1, bDef, 'main', 'bench'));
    expect(mainTeam).toHaveLength(11);
    expect(isValidFormation(mainTeam)).toBe(true);

    // Swap 2: main GK ↔ bench GK
    const gk1  = mainTeam.find(p => p.position === POSITION.GK);
    const bGk  = benchTeam.find(p => p.position === POSITION.GK);
    ({ mainTeam, benchTeam } = applySubstitution(mainTeam, benchTeam, gk1, bGk, 'main', 'bench'));
    expect(mainTeam).toHaveLength(11);
    expect(isValidFormation(mainTeam)).toBe(true);
  });

  it('no state corruption after multiple swaps: all player codes remain unique', () => {
    let { mainTeam, benchTeam } = makeSquad433();

    // Swap 1
    const def1 = mainTeam.find(p => p.position === POSITION.DEF);
    const bDef = benchTeam.find(p => p.position === POSITION.DEF);
    ({ mainTeam, benchTeam } = applySubstitution(mainTeam, benchTeam, def1, bDef, 'main', 'bench'));

    // Swap 2 (swap back)
    const defBack = mainTeam.find(p => p.code === bDef.code);
    const bDefBack = benchTeam.find(p => p.code === def1.code);
    ({ mainTeam, benchTeam } = applySubstitution(mainTeam, benchTeam, defBack, bDefBack, 'main', 'bench'));

    const allCodes = [...mainTeam, ...benchTeam].map(p => p.code);
    expect(new Set(allCodes).size).toBe(allCodes.length);
  });

  it('captain survives multiple substitutions and always stays in starting XI', () => {
    let { mainTeam, benchTeam } = makeSquad433();

    for (let i = 0; i < 3; i++) {
      const mainDEF = mainTeam.find(p => p.position === POSITION.DEF);
      const benchDEF = benchTeam.find(p => p.position === POSITION.DEF);
      if (!mainDEF || !benchDEF) break;
      ({ mainTeam, benchTeam } = applySubstitution(mainTeam, benchTeam, mainDEF, benchDEF, 'main', 'bench'));
      expect(mainTeam.some(p => p.is_captain)).toBe(true);
      expect(benchTeam.some(p => p.is_captain)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Property-based / fuzz tests
// ---------------------------------------------------------------------------

describe('property-based fuzz tests', () => {
  const rng = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

  const buildRandomSquad = () => {
    const nDef = rng(3, 5);
    const nFwd = rng(1, Math.min(3, 10 - nDef - 3));
    const nMid = 10 - nDef - nFwd;
    _code = 5000 + rng(0, 1000);
    const mainTeam = [
      makePlayer({ position: POSITION.GK, predictedPoints: rng(2, 10), basePoints: rng(2, 10) }),
      ...Array.from({ length: nDef }, () => makePlayer({ position: POSITION.DEF, predictedPoints: rng(2, 10), basePoints: rng(2, 10) })),
      ...Array.from({ length: nMid }, () => makePlayer({ position: POSITION.MID, predictedPoints: rng(2, 10), basePoints: rng(2, 10) })),
      ...Array.from({ length: nFwd }, () => makePlayer({ position: POSITION.FWD, predictedPoints: rng(2, 10), basePoints: rng(2, 10) })),
    ];
    const benchTeam = [
      makePlayer({ position: POSITION.GK }),
      makePlayer({ position: [POSITION.DEF, POSITION.MID, POSITION.FWD][rng(0, 2)] }),
      makePlayer({ position: [POSITION.DEF, POSITION.MID, POSITION.FWD][rng(0, 2)] }),
      makePlayer({ position: [POSITION.DEF, POSITION.MID, POSITION.FWD][rng(0, 2)] }),
    ];
    return { mainTeam, benchTeam };
  };

  it('random valid squads always satisfy isValidFormation', () => {
    for (let i = 0; i < 100; i++) {
      const { mainTeam } = buildRandomSquad();
      expect(isValidFormation(mainTeam)).toBe(true);
    }
  });

  it('GK ↔ GK swap always valid and formation stays valid', () => {
    for (let i = 0; i < 50; i++) {
      const { mainTeam, benchTeam } = buildRandomSquad();
      const mainGK  = mainTeam.find(p => p.position === POSITION.GK);
      const benchGK = benchTeam.find(p => p.position === POSITION.GK);
      const r = validateSubstitution(mainGK, benchGK, 'main', 'bench', mainTeam, benchTeam);
      expect(r.valid).toBe(true);
      const { mainTeam: newMain } = applySubstitution(mainTeam, benchTeam, mainGK, benchGK, 'main', 'bench');
      expect(isValidFormation(newMain)).toBe(true);
      expect(newMain).toHaveLength(11);
    }
  });

  it('no duplicate codes after any random valid GK swap', () => {
    for (let i = 0; i < 50; i++) {
      const { mainTeam, benchTeam } = buildRandomSquad();
      const mainGK  = mainTeam.find(p => p.position === POSITION.GK);
      const benchGK = benchTeam.find(p => p.position === POSITION.GK);
      const { mainTeam: newMain, benchTeam: newBench } = applySubstitution(
        mainTeam, benchTeam, mainGK, benchGK, 'main', 'bench'
      );
      const codes = [...newMain, ...newBench].map(p => p.code);
      expect(new Set(codes).size).toBe(codes.length);
    }
  });

  it('rejected swaps never leave an invalid formation', () => {
    // Verify that validateSubstitution correctly blocks formation-breaking swaps
    // by re-checking the post-swap formation when it reports invalid.
    for (let i = 0; i < 50; i++) {
      const { mainTeam, benchTeam } = buildRandomSquad();
      // Pick a random main outfield player and random bench outfield player.
      const outfield = mainTeam.filter(p => p.position !== POSITION.GK);
      const benchOut = benchTeam.filter(p => p.position !== POSITION.GK);
      if (!outfield.length || !benchOut.length) continue;
      const mPlayer = outfield[rng(0, outfield.length - 1)];
      const bPlayer = benchOut[rng(0, benchOut.length - 1)];
      const r = validateSubstitution(mPlayer, bPlayer, 'main', 'bench', mainTeam, benchTeam);
      if (!r.valid) {
        // Manually simulate and confirm it would have been invalid.
        const newMain = [...mainTeam];
        const newBench = [...benchTeam];
        const i1 = newMain.findIndex(p => p.code === mPlayer.code);
        const i2 = newBench.findIndex(p => p.code === bPlayer.code);
        newMain[i1] = bPlayer;
        newBench[i2] = mPlayer;
        expect(isValidFormation(newMain)).toBe(false);
      }
    }
  });
});
