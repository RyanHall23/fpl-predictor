/**
 * FPL Substitution Logic — pure, side-effect-free functions (ES module).
 *
 * Position codes mirror the FPL API:
 *   1 = GK, 2 = DEF, 3 = MID, 4 = FWD, 5 = Manager placeholder
 *
 * Frontend player objects use `position` (mapped from element_type during
 * formatting in useTeamData.js).  The helpers fall back to element_type so
 * the same functions work with both backend- and frontend-shaped objects.
 */

export const POSITION = Object.freeze({ GK: 1, DEF: 2, MID: 3, FWD: 4, MANAGER: 5 });

/** Extract the position code from a player object. */
const getPosition = (player) => player.position || player.element_type || 0;

/**
 * Count players at each position in the starting XI, ignoring manager slots.
 * @param {Array} mainTeam
 * @returns {{ [posCode]: number }}
 */
export const countPositions = (mainTeam) => {
  const counts = {
    [POSITION.GK]: 0,
    [POSITION.DEF]: 0,
    [POSITION.MID]: 0,
    [POSITION.FWD]: 0,
  };
  for (const p of mainTeam) {
    const pos = getPosition(p);
    if (pos in counts) counts[pos]++;
  }
  return counts;
};

/**
 * Return true when a starting XI satisfies all FPL formation constraints:
 *   ≥ 1 GK, ≥ 3 DEF, ≥ 3 MID, ≥ 1 FWD.
 * @param {Array} mainTeam
 * @returns {boolean}
 */
export const isValidFormation = (mainTeam) => {
  const c = countPositions(mainTeam);
  return c[POSITION.GK] >= 1 && c[POSITION.DEF] >= 3 && c[POSITION.MID] >= 3 && c[POSITION.FWD] >= 1;
};

/**
 * Return a human-readable formation violation message, or null if valid.
 * @param {Array} mainTeam
 * @returns {string|null}
 */
const getFormationError = (mainTeam) => {
  const c = countPositions(mainTeam);
  if (c[POSITION.GK] < 1) return 'The team must have at least 1 goalkeeper.';
  if (c[POSITION.DEF] < 3) return 'The team must have at least 3 defenders.';
  if (c[POSITION.MID] < 3) return 'The team must have at least 3 midfielders.';
  if (c[POSITION.FWD] < 1) return 'The team must have at least 1 forward.';
  return null;
};

/**
 * Validate whether swapping player1 ↔ player2 across their zones is legal.
 *
 * Rules enforced:
 *   - Must be a cross-zone swap (main ↔ bench)
 *   - GK can only swap with GK
 *   - Manager can only swap with manager
 *   - Resulting formation must satisfy ≥1 GK, ≥3 DEF, ≥3 MID, ≥1 FWD
 *   - Both players must be found in their stated zones (matched by `code`)
 *
 * @param {Object} player1
 * @param {Object} player2
 * @param {string} teamType1 - 'main' or 'bench'
 * @param {string} teamType2 - 'main' or 'bench'
 * @param {Array}  mainTeam
 * @param {Array}  benchTeam
 * @returns {{ valid: boolean, error: string }}
 */
export const validateSubstitution = (player1, player2, teamType1, teamType2, mainTeam, benchTeam) => {
  if (teamType1 === teamType2) {
    return {
      valid: false,
      error: 'Players can only be swapped between the starting squad and the bench.',
    };
  }

  const pos1 = getPosition(player1);
  const pos2 = getPosition(player2);

  if (pos1 === POSITION.MANAGER || pos2 === POSITION.MANAGER) {
    return pos1 === pos2
      ? { valid: true, error: '' }
      : { valid: false, error: 'Managers can only be swapped with other managers.' };
  }

  if (pos1 === POSITION.GK || pos2 === POSITION.GK) {
    if (pos1 !== pos2) {
      return { valid: false, error: 'Goalkeepers can only be swapped with other goalkeepers.' };
    }
  }

  const zone1 = teamType1 === 'main' ? mainTeam : benchTeam;
  const zone2 = teamType2 === 'main' ? mainTeam : benchTeam;

  const idx1 = zone1.findIndex((p) => p.code === player1.code);
  const idx2 = zone2.findIndex((p) => p.code === player2.code);

  if (idx1 === -1 || idx2 === -1) {
    return { valid: false, error: 'Player not found in their designated team zone.' };
  }

  // Simulate the swap and verify the resulting formation.
  const newMain = [...mainTeam];
  const newBench = [...benchTeam];

  if (teamType1 === 'main') {
    newMain[idx1] = player2;
    newBench[idx2] = player1;
  } else {
    newBench[idx1] = player2;
    newMain[idx2] = player1;
  }

  const formationError = getFormationError(newMain);
  if (formationError) {
    return { valid: false, error: formationError };
  }

  return { valid: true, error: '' };
};

/**
 * Derive a player's base (uncaptained) points.
 * Prefers the explicit `basePoints` field; otherwise reverses the multiplier.
 */
const getBase = (p) =>
  p.basePoints != null
    ? p.basePoints
    : Math.round((p.predictedPoints ?? 0) / (p.multiplier || 1));

/**
 * Apply a validated substitution to the squad, handling captain/vice-captain
 * transfers when either role-holder leaves the starting XI.
 *
 * Returns new { mainTeam, benchTeam } arrays without mutating the originals.
 * The incoming player **inherits the exact slot** of the outgoing player.
 *
 * @param {Array}  mainTeam
 * @param {Array}  benchTeam
 * @param {Object} player1
 * @param {Object} player2
 * @param {string} teamType1 - 'main' or 'bench'
 * @param {string} teamType2 - 'main' or 'bench'
 * @returns {{ mainTeam: Array, benchTeam: Array }}
 */
export const applySubstitution = (mainTeam, benchTeam, player1, player2, teamType1, teamType2) => {
  const newMain = [...mainTeam];
  const newBench = [...benchTeam];

  // Work against the mutable copies so indexes stay valid.
  const zone1 = teamType1 === 'main' ? newMain : newBench;
  const zone2 = teamType2 === 'main' ? newMain : newBench;

  const idx1 = zone1.findIndex((p) => p.code === player1.code);
  const idx2 = zone2.findIndex((p) => p.code === player2.code);

  if (idx1 === -1 || idx2 === -1) {
    return { mainTeam, benchTeam };
  }

  // Identify the player leaving the starting XI and the one coming in.
  const outPlayer = teamType1 === 'main' ? player1 : player2;
  const inPlayer  = teamType1 === 'bench' ? player1 : player2;

  let p1 = { ...player1 };
  let p2 = { ...player2 };

  // Captain transfer: outgoing captain → incoming player becomes captain.
  if (outPlayer.is_captain) {
    const outBase = Math.round(getBase(outPlayer));
    const inBase  = Math.round(getBase(inPlayer));
    if (p1.code === outPlayer.code) {
      p1 = { ...p1, is_captain: false, multiplier: 1, predictedPoints: outBase };
      p2 = { ...p2, is_captain: true,  multiplier: 2, predictedPoints: inBase * 2 };
    } else {
      p2 = { ...p2, is_captain: false, multiplier: 1, predictedPoints: Math.round(getBase(p2)) };
      p1 = { ...p1, is_captain: true,  multiplier: 2, predictedPoints: Math.round(getBase(p1)) * 2 };
    }
  }

  // Vice-captain transfer: outgoing vice (who is not captain) → incoming player.
  if (outPlayer.is_vice_captain && !outPlayer.is_captain) {
    if (p1.code === outPlayer.code) {
      p1 = { ...p1, is_vice_captain: false };
      p2 = { ...p2, is_vice_captain: true };
    } else {
      p2 = { ...p2, is_vice_captain: false };
      p1 = { ...p1, is_vice_captain: true };
    }
  }

  // Place the updated player objects into their new slots (exact index preserved).
  zone1[idx1] = p2;
  zone2[idx2] = p1;

  return { mainTeam: newMain, benchTeam: newBench };
};

/**
 * Calculate the score breakdown for a squad.
 * The captain's predictedPoints are already doubled (multiplier applied during
 * formatting), so total is simply the sum of all starting XI predictedPoints.
 *
 * @param {Array} mainTeam  - Starting XI
 * @param {Array} benchTeam - Bench players
 * @returns {{ totalPoints: number, benchPoints: number }}
 */
export const calculateScore = (mainTeam, benchTeam) => {
  const totalPoints = mainTeam.reduce((sum, p) => sum + (p.predictedPoints ?? 0), 0);
  const benchPoints = benchTeam.reduce((sum, p) => sum + (p.predictedPoints ?? 0), 0);
  return { totalPoints, benchPoints };
};

/**
 * Ensure captaincy is always held by a starting XI player (auto-correction for
 * corrupted state).  If the captain is on the bench, the vice-captain in the
 * starting XI is promoted to captain and a new vice is picked automatically.
 *
 * @param {Array} mainTeam
 * @param {Array} benchTeam
 * @returns {{ mainTeam: Array, benchTeam: Array }}
 */
export const normalizeCaptaincy = (mainTeam, benchTeam) => {
  const captainInMain = mainTeam.some((p) => p.is_captain);
  if (captainInMain) return { mainTeam, benchTeam };

  const viceInMain = mainTeam.find((p) => p.is_vice_captain);
  if (!viceInMain) return { mainTeam, benchTeam };

  const viceBase = getBase(viceInMain);

  // Strip captain from bench; promote vice to captain in starting XI.
  const newBench = benchTeam.map((p) =>
    p.is_captain ? { ...p, is_captain: false, multiplier: 1 } : p
  );
  let newMain = mainTeam.map((p) =>
    p.is_vice_captain
      ? { ...p, is_captain: true, is_vice_captain: false, multiplier: 2, predictedPoints: viceBase * 2 }
      : p
  );

  // Pick the new vice: highest base-points non-captain starter.
  const candidates = newMain.filter((p) => !p.is_captain && p.position !== POSITION.GK);
  const newVice = candidates.length > 0
    ? candidates.reduce((best, p) => getBase(p) > getBase(best) ? p : best)
    : null;

  if (newVice) {
    newMain = newMain.map((p) => ({ ...p, is_vice_captain: p.code === newVice.code }));
  }

  return { mainTeam: newMain, benchTeam: newBench };
};
