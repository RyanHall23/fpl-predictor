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
 * Returns { activePlayers, reservePlayers }.
 */
const makeSquad433 = () => {
  _code = 100;
  const activePlayers = [
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
  const reservePlayers = [
    makePlayer({ position: POSITION.GK,  code: 111, predictedPoints: 3, basePoints: 3 }),
    makePlayer({ position: POSITION.DEF, code: 112, predictedPoints: 4, basePoints: 4 }),
    makePlayer({ position: POSITION.MID, code: 113, predictedPoints: 4, basePoints: 4 }),
    makePlayer({ position: POSITION.FWD, code: 114, predictedPoints: 4, basePoints: 4 }),
  ];
  return { activePlayers, reservePlayers };
};

// ---------------------------------------------------------------------------
// countPositions
// ---------------------------------------------------------------------------

describe('countPositions', () => {
  it('correctly tallies a 4-3-3', () => {
    const { activePlayers } = makeSquad433();
    const counts = countPositions(activePlayers);
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
    const { activePlayers } = makeSquad433();
    expect(isValidFormation(activePlayers)).toBe(true);
  });

  it('accepts a 5-3-2 (max DEF, min FWD)', () => {
    _code = 200;
    const activePlayers = [
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
    expect(isValidFormation(activePlayers)).toBe(true);
  });

  it('rejects exactly 2 DEF', () => {
    _code = 300;
    const activePlayers = [
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
    expect(isValidFormation(activePlayers)).toBe(false);
  });

  it('rejects exactly 2 MID', () => {
    _code = 400;
    const activePlayers = [
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
    expect(isValidFormation(activePlayers)).toBe(false);
  });

  it('rejects 0 FWD', () => {
    _code = 500;
    const activePlayers = [
      makePlayer({ position: POSITION.GK  }),
      ...Array.from({ length: 5 }, () => makePlayer({ position: POSITION.DEF })),
      ...Array.from({ length: 5 }, () => makePlayer({ position: POSITION.MID })),
    ];
    expect(isValidFormation(activePlayers)).toBe(false);
  });

  it('rejects 0 GK', () => {
    _code = 600;
    const activePlayers = Array.from({ length: 11 }, () => makePlayer({ position: POSITION.DEF }));
    expect(isValidFormation(activePlayers)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateSubstitution — zone enforcement
// ---------------------------------------------------------------------------

describe('validateSubstitution — zone rules', () => {
  it('rejects main-main swap', () => {
    const { activePlayers, reservePlayers } = makeSquad433();
    const r = validateSubstitution(activePlayers[1], activePlayers[2], 'active', 'active', activePlayers, reservePlayers);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/reserve/i);
  });

  it('rejects bench-bench swap', () => {
    const { activePlayers, reservePlayers } = makeSquad433();
    const r = validateSubstitution(reservePlayers[0], reservePlayers[1], 'reserve', 'reserve', activePlayers, reservePlayers);
    expect(r.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateSubstitution — GK rule
// ---------------------------------------------------------------------------

describe('validateSubstitution — GK rule (GK can only swap with GK)', () => {
  it('allows GK ↔ GK swap', () => {
    const { activePlayers, reservePlayers } = makeSquad433();
    const mainGK  = activePlayers.find(p => p.position === POSITION.GK);
    const benchGK = reservePlayers.find(p => p.position === POSITION.GK);
    const r = validateSubstitution(mainGK, benchGK, 'active', 'reserve', activePlayers, reservePlayers);
    expect(r.valid).toBe(true);
  });

  it('rejects GK ↔ DEF swap', () => {
    const { activePlayers, reservePlayers } = makeSquad433();
    const mainGK   = activePlayers.find(p => p.position === POSITION.GK);
    const benchDEF = reservePlayers.find(p => p.position === POSITION.DEF);
    const r = validateSubstitution(mainGK, benchDEF, 'active', 'reserve', activePlayers, reservePlayers);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/goalkeeper/i);
  });

  it('rejects DEF ↔ GK swap (bench GK coming in)', () => {
    const { activePlayers, reservePlayers } = makeSquad433();
    const mainDEF = activePlayers.find(p => p.position === POSITION.DEF);
    const benchGK = reservePlayers.find(p => p.position === POSITION.GK);
    const r = validateSubstitution(mainDEF, benchGK, 'active', 'reserve', activePlayers, reservePlayers);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/goalkeeper/i);
  });

  it('rejects GK ↔ FWD swap', () => {
    const { activePlayers, reservePlayers } = makeSquad433();
    const mainGK   = activePlayers.find(p => p.position === POSITION.GK);
    const benchFWD = reservePlayers.find(p => p.position === POSITION.FWD);
    const r = validateSubstitution(mainGK, benchFWD, 'active', 'reserve', activePlayers, reservePlayers);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/goalkeeper/i);
  });
});

// ---------------------------------------------------------------------------
// validateSubstitution — same-position cross-zone
// ---------------------------------------------------------------------------

describe('validateSubstitution — same-position valid swaps', () => {
  it('allows DEF ↔ DEF swap', () => {
    const { activePlayers, reservePlayers } = makeSquad433();
    const mainDEF  = activePlayers.find(p => p.position === POSITION.DEF);
    const benchDEF = reservePlayers.find(p => p.position === POSITION.DEF);
    const r = validateSubstitution(mainDEF, benchDEF, 'active', 'reserve', activePlayers, reservePlayers);
    expect(r.valid).toBe(true);
  });

  it('allows MID ↔ MID swap', () => {
    const { activePlayers, reservePlayers } = makeSquad433();
    const mainMID  = activePlayers.find(p => p.position === POSITION.MID);
    const benchMID = reservePlayers.find(p => p.position === POSITION.MID);
    const r = validateSubstitution(mainMID, benchMID, 'active', 'reserve', activePlayers, reservePlayers);
    expect(r.valid).toBe(true);
  });

  it('allows FWD ↔ FWD swap', () => {
    const { activePlayers, reservePlayers } = makeSquad433();
    const mainFWD  = activePlayers.find(p => p.position === POSITION.FWD);
    const benchFWD = reservePlayers.find(p => p.position === POSITION.FWD);
    const r = validateSubstitution(mainFWD, benchFWD, 'active', 'reserve', activePlayers, reservePlayers);
    expect(r.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateSubstitution — cross-position formation checks
// ---------------------------------------------------------------------------

describe('validateSubstitution — cross-position formation enforcement', () => {
  it('rejects MID ↔ FWD swap when it would drop MID below minimum', () => {
    // 4-3-3: removing any MID → 2 MID violates minimum
    const { activePlayers, reservePlayers } = makeSquad433();
    const mainMID  = activePlayers.find(p => p.position === POSITION.MID && !p.is_captain);
    const benchFWD = reservePlayers.find(p => p.position === POSITION.FWD);
    const r = validateSubstitution(mainMID, benchFWD, 'active', 'reserve', activePlayers, reservePlayers);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/midfielder/i);
  });

  it('allows DEF ↔ MID swap when DEF stays ≥ 3', () => {
    // 4-3-3: remove one DEF, add bench MID → 3 DEF, 4 MID, 3 FWD (valid)
    const { activePlayers, reservePlayers } = makeSquad433();
    const mainDEF  = activePlayers.find(p => p.position === POSITION.DEF);
    const benchMID = reservePlayers.find(p => p.position === POSITION.MID);
    const r = validateSubstitution(mainDEF, benchMID, 'active', 'reserve', activePlayers, reservePlayers);
    expect(r.valid).toBe(true);
  });

  it('rejects DEF ↔ MID swap when it would drop DEF below 3', () => {
    // Build 3-3-4 (minimum DEF); removing one DEF → 2 DEF
    _code = 1000;
    const activePlayers = [
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
    const reservePlayers = [
      makePlayer({ position: POSITION.GK  }),
      makePlayer({ position: POSITION.MID }),
      makePlayer({ position: POSITION.MID }),
      makePlayer({ position: POSITION.FWD }),
    ];
    const mainDEF  = activePlayers.find(p => p.position === POSITION.DEF);
    const benchMID = reservePlayers.find(p => p.position === POSITION.MID);
    const r = validateSubstitution(mainDEF, benchMID, 'active', 'reserve', activePlayers, reservePlayers);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/defender/i);
  });

  it('rejects FWD ↔ MID swap when it would drop FWD below 1', () => {
    _code = 1100;
    const activePlayers = [
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
    const reservePlayers = [
      makePlayer({ position: POSITION.GK  }),
      makePlayer({ position: POSITION.MID }),
      makePlayer({ position: POSITION.DEF }),
      makePlayer({ position: POSITION.DEF }),
    ];
    const mainFWD  = activePlayers.find(p => p.position === POSITION.FWD);
    const benchMID = reservePlayers.find(p => p.position === POSITION.MID);
    const r = validateSubstitution(mainFWD, benchMID, 'active', 'reserve', activePlayers, reservePlayers);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/forward/i);
  });
});

// ---------------------------------------------------------------------------
// validateSubstitution — player not found
// ---------------------------------------------------------------------------

describe('validateSubstitution — player not found', () => {
  it('rejects when player is not in the stated zone', () => {
    const { activePlayers, reservePlayers } = makeSquad433();
    _code = 9999;
    const stranger = makePlayer({ position: POSITION.MID });
    const benchMID = reservePlayers.find(p => p.position === POSITION.MID);
    const r = validateSubstitution(stranger, benchMID, 'active', 'reserve', activePlayers, reservePlayers);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/not found/i);
  });
});

// ---------------------------------------------------------------------------
// applySubstitution — position slot preservation
// ---------------------------------------------------------------------------

describe('applySubstitution — slot preservation', () => {
  it('incoming player occupies the exact slot of the outgoing player', () => {
    const { activePlayers, reservePlayers } = makeSquad433();
    const mainDEF  = activePlayers.find(p => p.position === POSITION.DEF);
    const benchDEF = reservePlayers.find(p => p.position === POSITION.DEF);
    const slotIndex = activePlayers.indexOf(mainDEF);

    const { activePlayers: newMain } = applySubstitution(
      activePlayers, reservePlayers, mainDEF, benchDEF, 'active', 'reserve'
    );

    expect(newMain[slotIndex].code).toBe(benchDEF.code);
  });

  it('outgoing player occupies the exact bench slot of the incoming player', () => {
    const { activePlayers, reservePlayers } = makeSquad433();
    const mainDEF  = activePlayers.find(p => p.position === POSITION.DEF);
    const benchDEF = reservePlayers.find(p => p.position === POSITION.DEF);
    const benchSlot = reservePlayers.indexOf(benchDEF);

    const { reservePlayers: newBench } = applySubstitution(
      activePlayers, reservePlayers, mainDEF, benchDEF, 'active', 'reserve'
    );

    expect(newBench[benchSlot].code).toBe(mainDEF.code);
  });

  it('does not change the order of players not involved in the swap', () => {
    const { activePlayers, reservePlayers } = makeSquad433();
    const mainGK  = activePlayers.find(p => p.position === POSITION.GK);
    const benchGK = reservePlayers.find(p => p.position === POSITION.GK);

    const { activePlayers: newMain } = applySubstitution(
      activePlayers, reservePlayers, mainGK, benchGK, 'active', 'reserve'
    );

    // All other main team players should be in the same slots.
    activePlayers.forEach((p, idx) => {
      if (p.code !== mainGK.code) {
        expect(newMain[idx].code).toBe(p.code);
      }
    });
  });

  it('does not mutate the original arrays', () => {
    const { activePlayers, reservePlayers } = makeSquad433();
    const snapshot = activePlayers.map(p => p.code);
    const mainDEF  = activePlayers.find(p => p.position === POSITION.DEF);
    const benchDEF = reservePlayers.find(p => p.position === POSITION.DEF);

    applySubstitution(activePlayers, reservePlayers, mainDEF, benchDEF, 'active', 'reserve');

    expect(activePlayers.map(p => p.code)).toEqual(snapshot);
  });
});

// ---------------------------------------------------------------------------
// applySubstitution — captain transfer
// ---------------------------------------------------------------------------

describe('applySubstitution — captain logic', () => {
  it('incoming player becomes captain when captain is substituted off', () => {
    const { activePlayers, reservePlayers } = makeSquad433();
    const captain  = activePlayers.find(p => p.is_captain);
    const benchMID = reservePlayers.find(p => p.position === POSITION.MID);

    const { activePlayers: newMain, reservePlayers: newBench } = applySubstitution(
      activePlayers, reservePlayers, captain, benchMID, 'active', 'reserve'
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
    const { activePlayers, reservePlayers } = makeSquad433();
    const captain  = activePlayers.find(p => p.is_captain);
    const benchFWD = reservePlayers.find(p => p.position === POSITION.FWD);

    // We need a valid swap - captain is MID, bench is FWD. In 4-3-3 this removes
    // a MID making 2 MID which is invalid. Use bench MID instead.
    const benchMID = reservePlayers.find(p => p.position === POSITION.MID);
    const { reservePlayers: newBench } = applySubstitution(
      activePlayers, reservePlayers, captain, benchMID, 'active', 'reserve'
    );

    const captainOnBench = newBench.some(p => p.is_captain);
    expect(captainOnBench).toBe(false);
  });

  it('non-captain swap leaves captaincy unchanged', () => {
    const { activePlayers, reservePlayers } = makeSquad433();
    const captainCode = activePlayers.find(p => p.is_captain).code;
    const mainDEF  = activePlayers.find(p => p.position === POSITION.DEF);
    const benchDEF = reservePlayers.find(p => p.position === POSITION.DEF);

    const { activePlayers: newMain } = applySubstitution(
      activePlayers, reservePlayers, mainDEF, benchDEF, 'active', 'reserve'
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
    const { activePlayers, reservePlayers } = makeSquad433();
    const vice     = activePlayers.find(p => p.is_vice_captain && !p.is_captain);
    const benchDEF = reservePlayers.find(p => p.position === POSITION.DEF);

    // vice is a FWD; swap for bench DEF — 4-3-3 → 3 DEF+1 DEF back = valid (4 DEF, 3 MID, 2 FWD)
    // Actually need to check this is valid. Let's just use bench FWD.
    const benchFWD = reservePlayers.find(p => p.position === POSITION.FWD);
    const { activePlayers: newMain, reservePlayers: newBench } = applySubstitution(
      activePlayers, reservePlayers, vice, benchFWD, 'active', 'reserve'
    );

    const incomingInMain = newMain.find(p => p.code === benchFWD.code);
    expect(incomingInMain.is_vice_captain).toBe(true);

    const oldViceOnBench = newBench.find(p => p.code === vice.code);
    expect(oldViceOnBench.is_vice_captain).toBe(false);
  });

  it('vice-captain is never on bench after the swap', () => {
    const { activePlayers, reservePlayers } = makeSquad433();
    const vice    = activePlayers.find(p => p.is_vice_captain && !p.is_captain);
    const benchFWD = reservePlayers.find(p => p.position === POSITION.FWD);

    const { reservePlayers: newBench } = applySubstitution(
      activePlayers, reservePlayers, vice, benchFWD, 'active', 'reserve'
    );

    const viceOnBench = newBench.some(p => p.is_vice_captain);
    expect(viceOnBench).toBe(false);
  });

  it('non-vice swap leaves vice-captain unchanged', () => {
    const { activePlayers, reservePlayers } = makeSquad433();
    const viceCode = activePlayers.find(p => p.is_vice_captain).code;
    const mainDEF  = activePlayers.find(p => p.position === POSITION.DEF);
    const benchDEF = reservePlayers.find(p => p.position === POSITION.DEF);

    const { activePlayers: newMain } = applySubstitution(
      activePlayers, reservePlayers, mainDEF, benchDEF, 'active', 'reserve'
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
    const { activePlayers, reservePlayers } = makeSquad433();
    const expected = activePlayers.reduce((s, p) => s + p.predictedPoints, 0);
    const { totalPoints } = calculateScore(activePlayers, reservePlayers);
    expect(totalPoints).toBe(expected);
  });

  it('sums bench predictedPoints as reservePoints', () => {
    const { activePlayers, reservePlayers } = makeSquad433();
    const expected = reservePlayers.reduce((s, p) => s + p.predictedPoints, 0);
    const { reservePoints } = calculateScore(activePlayers, reservePlayers);
    expect(reservePoints).toBe(expected);
  });

  it('bench points do not affect totalPoints', () => {
    const { activePlayers, reservePlayers } = makeSquad433();
    const { totalPoints } = calculateScore(activePlayers, reservePlayers);
    const mainOnly = activePlayers.reduce((s, p) => s + p.predictedPoints, 0);
    expect(totalPoints).toBe(mainOnly);
  });

  it('captain doubling is reflected in totalPoints (already baked into predictedPoints)', () => {
    const { activePlayers, reservePlayers } = makeSquad433();
    const captain = activePlayers.find(p => p.is_captain);
    // Captain has predictedPoints = basePoints * 2
    expect(captain.predictedPoints).toBe(captain.basePoints * 2);
    const { totalPoints } = calculateScore(activePlayers, reservePlayers);
    // Removing captain and adding base confirms the doubling is included
    const withoutCaptain = activePlayers.filter(p => !p.is_captain).reduce((s, p) => s + p.predictedPoints, 0);
    expect(totalPoints).toBe(withoutCaptain + captain.predictedPoints);
  });

  it('score recalculates correctly after a substitution', () => {
    const { activePlayers, reservePlayers } = makeSquad433();
    const mainDEF  = activePlayers.find(p => p.position === POSITION.DEF);
    const benchDEF = reservePlayers.find(p => p.position === POSITION.DEF);

    const { activePlayers: newMain, reservePlayers: newBench } = applySubstitution(
      activePlayers, reservePlayers, mainDEF, benchDEF, 'active', 'reserve'
    );

    const { totalPoints: before } = calculateScore(activePlayers, reservePlayers);
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
    const { activePlayers, reservePlayers } = makeSquad433();
    const { activePlayers: newMain } = normalizeCaptaincy(activePlayers, reservePlayers);
    const cap = newMain.find(p => p.is_captain);
    expect(cap).toBeDefined();
    expect(activePlayers.find(p => p.is_captain).code).toBe(cap.code);
  });

  it('promotes vice-captain to captain when captain is on bench', () => {
    const { activePlayers, reservePlayers } = makeSquad433();
    // Corrupt state: move captain to bench without proper transfer
    const captainIdx = activePlayers.findIndex(p => p.is_captain);
    const captain = activePlayers[captainIdx];
    const corruptedMain  = activePlayers.map((p, i) => i === captainIdx ? { ...p, is_captain: false } : p);
    const corruptedBench = [...reservePlayers, { ...captain, is_captain: true }];

    const { activePlayers: fixed } = normalizeCaptaincy(corruptedMain, corruptedBench);

    // The vice-captain should now be the captain.
    const viceCode = corruptedMain.find(p => p.is_vice_captain).code;
    const newCap = fixed.find(p => p.is_captain);
    expect(newCap).toBeDefined();
    expect(newCap.code).toBe(viceCode);
    expect(newCap.multiplier).toBe(2);
  });

  it('strips captain from bench when normalizing', () => {
    const { activePlayers, reservePlayers } = makeSquad433();
    const captainIdx = activePlayers.findIndex(p => p.is_captain);
    const captain = activePlayers[captainIdx];
    const corruptedMain  = activePlayers.map((p, i) => i === captainIdx ? { ...p, is_captain: false } : p);
    const corruptedBench = [...reservePlayers, { ...captain, is_captain: true }];

    const { reservePlayers: fixedBench } = normalizeCaptaincy(corruptedMain, corruptedBench);
    expect(fixedBench.some(p => p.is_captain)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Regression: sequential substitutions
// ---------------------------------------------------------------------------

describe('sequential substitutions — regression coverage', () => {
  it('two consecutive valid swaps preserve 11 starters and a valid formation', () => {
    let { activePlayers, reservePlayers } = makeSquad433();

    // Swap 1: main DEF ↔ bench DEF
    const def1 = activePlayers.find(p => p.position === POSITION.DEF);
    const bDef = reservePlayers.find(p => p.position === POSITION.DEF);
    ({ activePlayers, reservePlayers } = applySubstitution(activePlayers, reservePlayers, def1, bDef, 'active', 'reserve'));
    expect(activePlayers).toHaveLength(11);
    expect(isValidFormation(activePlayers)).toBe(true);

    // Swap 2: main GK ↔ bench GK
    const gk1  = activePlayers.find(p => p.position === POSITION.GK);
    const bGk  = reservePlayers.find(p => p.position === POSITION.GK);
    ({ activePlayers, reservePlayers } = applySubstitution(activePlayers, reservePlayers, gk1, bGk, 'active', 'reserve'));
    expect(activePlayers).toHaveLength(11);
    expect(isValidFormation(activePlayers)).toBe(true);
  });

  it('no state corruption after multiple swaps: all player codes remain unique', () => {
    let { activePlayers, reservePlayers } = makeSquad433();

    // Swap 1
    const def1 = activePlayers.find(p => p.position === POSITION.DEF);
    const bDef = reservePlayers.find(p => p.position === POSITION.DEF);
    ({ activePlayers, reservePlayers } = applySubstitution(activePlayers, reservePlayers, def1, bDef, 'active', 'reserve'));

    // Swap 2 (swap back)
    const defBack = activePlayers.find(p => p.code === bDef.code);
    const bDefBack = reservePlayers.find(p => p.code === def1.code);
    ({ activePlayers, reservePlayers } = applySubstitution(activePlayers, reservePlayers, defBack, bDefBack, 'active', 'reserve'));

    const allCodes = [...activePlayers, ...reservePlayers].map(p => p.code);
    expect(new Set(allCodes).size).toBe(allCodes.length);
  });

  it('captain survives multiple substitutions and always stays in starting XI', () => {
    let { activePlayers, reservePlayers } = makeSquad433();

    for (let i = 0; i < 3; i++) {
      const mainDEF = activePlayers.find(p => p.position === POSITION.DEF);
      const benchDEF = reservePlayers.find(p => p.position === POSITION.DEF);
      if (!mainDEF || !benchDEF) break;
      ({ activePlayers, reservePlayers } = applySubstitution(activePlayers, reservePlayers, mainDEF, benchDEF, 'active', 'reserve'));
      expect(activePlayers.some(p => p.is_captain)).toBe(true);
      expect(reservePlayers.some(p => p.is_captain)).toBe(false);
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
    const activePlayers = [
      makePlayer({ position: POSITION.GK, predictedPoints: rng(2, 10), basePoints: rng(2, 10) }),
      ...Array.from({ length: nDef }, () => makePlayer({ position: POSITION.DEF, predictedPoints: rng(2, 10), basePoints: rng(2, 10) })),
      ...Array.from({ length: nMid }, () => makePlayer({ position: POSITION.MID, predictedPoints: rng(2, 10), basePoints: rng(2, 10) })),
      ...Array.from({ length: nFwd }, () => makePlayer({ position: POSITION.FWD, predictedPoints: rng(2, 10), basePoints: rng(2, 10) })),
    ];
    const reservePlayers = [
      makePlayer({ position: POSITION.GK }),
      makePlayer({ position: [POSITION.DEF, POSITION.MID, POSITION.FWD][rng(0, 2)] }),
      makePlayer({ position: [POSITION.DEF, POSITION.MID, POSITION.FWD][rng(0, 2)] }),
      makePlayer({ position: [POSITION.DEF, POSITION.MID, POSITION.FWD][rng(0, 2)] }),
    ];
    return { activePlayers, reservePlayers };
  };

  it('random valid squads always satisfy isValidFormation', () => {
    for (let i = 0; i < 100; i++) {
      const { activePlayers } = buildRandomSquad();
      expect(isValidFormation(activePlayers)).toBe(true);
    }
  });

  it('GK ↔ GK swap always valid and formation stays valid', () => {
    for (let i = 0; i < 50; i++) {
      const { activePlayers, reservePlayers } = buildRandomSquad();
      const mainGK  = activePlayers.find(p => p.position === POSITION.GK);
      const benchGK = reservePlayers.find(p => p.position === POSITION.GK);
      const r = validateSubstitution(mainGK, benchGK, 'active', 'reserve', activePlayers, reservePlayers);
      expect(r.valid).toBe(true);
      const { activePlayers: newMain } = applySubstitution(activePlayers, reservePlayers, mainGK, benchGK, 'active', 'reserve');
      expect(isValidFormation(newMain)).toBe(true);
      expect(newMain).toHaveLength(11);
    }
  });

  it('no duplicate codes after any random valid GK swap', () => {
    for (let i = 0; i < 50; i++) {
      const { activePlayers, reservePlayers } = buildRandomSquad();
      const mainGK  = activePlayers.find(p => p.position === POSITION.GK);
      const benchGK = reservePlayers.find(p => p.position === POSITION.GK);
      const { activePlayers: newMain, reservePlayers: newBench } = applySubstitution(
        activePlayers, reservePlayers, mainGK, benchGK, 'active', 'reserve'
      );
      const codes = [...newMain, ...newBench].map(p => p.code);
      expect(new Set(codes).size).toBe(codes.length);
    }
  });

  it('rejected swaps never leave an invalid formation', () => {
    // Verify that validateSubstitution correctly blocks formation-breaking swaps
    // by re-checking the post-swap formation when it reports invalid.
    for (let i = 0; i < 50; i++) {
      const { activePlayers, reservePlayers } = buildRandomSquad();
      // Pick a random main outfield player and random bench outfield player.
      const outfield = activePlayers.filter(p => p.position !== POSITION.GK);
      const benchOut = reservePlayers.filter(p => p.position !== POSITION.GK);
      if (!outfield.length || !benchOut.length) continue;
      const mPlayer = outfield[rng(0, outfield.length - 1)];
      const bPlayer = benchOut[rng(0, benchOut.length - 1)];
      const r = validateSubstitution(mPlayer, bPlayer, 'active', 'reserve', activePlayers, reservePlayers);
      if (!r.valid) {
        // Manually simulate and confirm it would have been invalid.
        const newMain = [...activePlayers];
        const newBench = [...reservePlayers];
        const i1 = newMain.findIndex(p => p.code === mPlayer.code);
        const i2 = newBench.findIndex(p => p.code === bPlayer.code);
        newMain[i1] = bPlayer;
        newBench[i2] = mPlayer;
        expect(isValidFormation(newMain)).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Regression: future-GW demoted-player captain swap
//
// selectOptimalLineup can demote a low-pts main player to the *effective* bench
// while keeping them in rawMainTeam.  validateSubstitution must accept the
// effective teams (effectiveMain / effectiveBench) so that the captain can be
// swapped with the demoted player without hitting a "same zone" error.
// ---------------------------------------------------------------------------

describe('future-GW demoted-player captain swap (regression)', () => {
  it('rejects the swap when callers mistakenly pass raw activePlayers for both zones', () => {
    // Set up: MID4 has low pts and has been demoted to the effective bench by
    // selectOptimalLineup, but it is still present in rawMain.
    const MID4 = makePlayer({ code: 201, position: POSITION.MID, predictedPoints: 3, basePoints: 3 });
    const captain = makePlayer({ code: 202, position: POSITION.MID, predictedPoints: 14, basePoints: 7, is_captain: true, multiplier: 2 });

    // rawMain still contains MID4 (it has not been moved out yet)
    const rawMain = [
      makePlayer({ code: 200, position: POSITION.GK }),
      makePlayer({ code: 210, position: POSITION.DEF }),
      makePlayer({ code: 211, position: POSITION.DEF }),
      makePlayer({ code: 212, position: POSITION.DEF }),
      captain,
      makePlayer({ code: 213, position: POSITION.MID }),
      makePlayer({ code: 214, position: POSITION.MID }),
      makePlayer({ code: 215, position: POSITION.FWD }),
      makePlayer({ code: 216, position: POSITION.FWD }),
      makePlayer({ code: 217, position: POSITION.FWD }),
      MID4,  // low-pts player still in raw main
    ];
    const rawBench = [
      makePlayer({ code: 220, position: POSITION.GK }),
      makePlayer({ code: 221, position: POSITION.DEF }),
      makePlayer({ code: 222, position: POSITION.MID, predictedPoints: 8, basePoints: 8 }), // promoted
      makePlayer({ code: 223, position: POSITION.FWD }),
    ];

    // Simulating the old bug: rawTeamType resolves MID4 as 'active' (it is in rawMain)
    // so the caller passes teamType='active' for both captain and MID4 → rejected.
    const buggyResult = validateSubstitution(captain, MID4, 'active', 'active', rawMain, rawBench);
    expect(buggyResult.valid).toBe(false);
    expect(buggyResult.error).toMatch(/swapped between the active squad and the reserve/i);
  });

  it('accepts the captain swap when called with the effective (displayed) teams', () => {
    const MID4 = makePlayer({ code: 201, position: POSITION.MID, predictedPoints: 3, basePoints: 3 });
    const MID5 = makePlayer({ code: 222, position: POSITION.MID, predictedPoints: 8, basePoints: 8 });
    const captain = makePlayer({ code: 202, position: POSITION.MID, predictedPoints: 14, basePoints: 7, is_captain: true, multiplier: 2 });

    // effectiveMain: selectOptimalLineup promoted MID5 from bench and excluded MID4
    const effectiveMain = [
      makePlayer({ code: 200, position: POSITION.GK }),
      makePlayer({ code: 210, position: POSITION.DEF }),
      makePlayer({ code: 211, position: POSITION.DEF }),
      makePlayer({ code: 212, position: POSITION.DEF }),
      captain,
      makePlayer({ code: 213, position: POSITION.MID }),
      makePlayer({ code: 214, position: POSITION.MID }),
      makePlayer({ code: 215, position: POSITION.FWD }),
      makePlayer({ code: 216, position: POSITION.FWD }),
      makePlayer({ code: 217, position: POSITION.FWD }),
      MID5,  // promoted from bench
    ];
    // effectiveBench: MID4 was demoted here; MID5 is now in effectiveMain
    const effectiveBench = [
      makePlayer({ code: 220, position: POSITION.GK }),
      makePlayer({ code: 221, position: POSITION.DEF }),
      MID4,   // demoted from raw main → appears in effective bench
      makePlayer({ code: 223, position: POSITION.FWD }),
    ];

    // Fix: zone resolved from effective teams → captain='active', MID4='reserve'
    const result = validateSubstitution(captain, MID4, 'active', 'reserve', effectiveMain, effectiveBench);
    expect(result.valid).toBe(true);
    expect(result.error).toBe('');
  });

  it('applies the captain swap correctly when effective teams are used', () => {
    const MID4 = makePlayer({ code: 201, position: POSITION.MID, predictedPoints: 3, basePoints: 3 });
    const MID5 = makePlayer({ code: 222, position: POSITION.MID, predictedPoints: 8, basePoints: 8 });
    const captain = makePlayer({ code: 202, position: POSITION.MID, predictedPoints: 14, basePoints: 7, is_captain: true, multiplier: 2 });

    const captainIdx = 4;
    const effectiveMain = [
      makePlayer({ code: 200, position: POSITION.GK }),
      makePlayer({ code: 210, position: POSITION.DEF }),
      makePlayer({ code: 211, position: POSITION.DEF }),
      makePlayer({ code: 212, position: POSITION.DEF }),
      captain,  // index 4
      makePlayer({ code: 213, position: POSITION.MID }),
      makePlayer({ code: 214, position: POSITION.MID }),
      makePlayer({ code: 215, position: POSITION.FWD }),
      makePlayer({ code: 216, position: POSITION.FWD }),
      makePlayer({ code: 217, position: POSITION.FWD }),
      MID5,
    ];
    const mid4BenchIdx = 2;
    const effectiveBench = [
      makePlayer({ code: 220, position: POSITION.GK }),
      makePlayer({ code: 221, position: POSITION.DEF }),
      MID4,  // index 2
      makePlayer({ code: 223, position: POSITION.FWD }),
    ];

    const { activePlayers: newMain, reservePlayers: newBench } = applySubstitution(
      effectiveMain, effectiveBench, captain, MID4, 'active', 'reserve'
    );

    // MID4 should now be at the captain's slot in main, and inherit captaincy
    expect(newMain[captainIdx].code).toBe(MID4.code);
    expect(newMain[captainIdx].is_captain).toBe(true);
    expect(newMain[captainIdx].multiplier).toBe(2);
    expect(newMain[captainIdx].predictedPoints).toBe(MID4.basePoints * 2);

    // Captain should now be on the bench at MID4's old slot, no longer captain
    expect(newBench[mid4BenchIdx].code).toBe(captain.code);
    expect(newBench[mid4BenchIdx].is_captain).toBe(false);

    // Rest of main team unchanged
    expect(newMain.filter(p => p.code !== MID4.code)).toHaveLength(10);
  });
});
