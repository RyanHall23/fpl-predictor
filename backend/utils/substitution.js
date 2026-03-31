'use strict';

/**
 * FPL Substitution Logic — pure, side-effect-free functions.
 *
 * Position codes mirror the FPL API:
 *   1 = GK, 2 = DEF, 3 = MID, 4 = FWD, 5 = Manager placeholder
 */

const POSITION = Object.freeze({ GK: 1, DEF: 2, MID: 3, FWD: 4, MANAGER: 5 });

/**
 * Extract the position code from a player object.
 * Handles both backend format (element_type) and frontend format (position).
 */
const getPosition = (player) => player.element_type || player.position || 0;

/**
 * Count outfield/GK positions in a starting XI, ignoring manager slots.
 * @param {Array} mainTeam
 * @returns {{ [posCode]: number }}
 */
const countPositions = (mainTeam) => {
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
 *
 * @param {Array} mainTeam
 * @returns {boolean}
 */
const isValidFormation = (mainTeam) => {
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
 *   - Both players must be found in their stated zones
 *
 * @param {Object} player1
 * @param {Object} player2
 * @param {string} teamType1 - 'main' or 'bench'
 * @param {string} teamType2 - 'main' or 'bench'
 * @param {Array}  mainTeam
 * @param {Array}  benchTeam
 * @returns {{ valid: boolean, error: string }}
 */
const validateSubstitution = (player1, player2, teamType1, teamType2, mainTeam, benchTeam) => {
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

module.exports = {
  POSITION,
  getPosition,
  countPositions,
  isValidFormation,
  getFormationError,
  validateSubstitution,
};
