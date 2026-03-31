'use strict';

/**
 * FPL Substitution Logic — pure, side-effect-free functions.
 *
 * Position codes mirror the FPL API:
 *   1 = GK, 2 = DEF, 3 = MID, 4 = FWD, 5 = Manager placeholder
 *
 * Zone terminology:
 *   'active'  — the starting XI
 *   'reserve' — the bench
 */

const POSITION = Object.freeze({ GK: 1, DEF: 2, MID: 3, FWD: 4, MANAGER: 5 });

/**
 * Extract the position code from a player object.
 * Handles both backend format (element_type) and frontend format (position).
 */
const getPosition = (player) => player.element_type || player.position || 0;

/**
 * Count outfield/GK positions in the active XI, ignoring manager slots.
 * @param {Array} activePlayers
 * @returns {{ [posCode]: number }}
 */
const countPositions = (activePlayers) => {
  const counts = {
    [POSITION.GK]: 0,
    [POSITION.DEF]: 0,
    [POSITION.MID]: 0,
    [POSITION.FWD]: 0,
  };
  for (const p of activePlayers) {
    const pos = getPosition(p);
    if (pos in counts) counts[pos]++;
  }
  return counts;
};

/**
 * Return true when a starting XI satisfies all FPL formation constraints:
 *   ≥ 1 GK, ≥ 3 DEF, ≥ 3 MID, ≥ 1 FWD.
 *
 * @param {Array} activePlayers
 * @returns {boolean}
 */
const isValidFormation = (activePlayers) => {
  const c = countPositions(activePlayers);
  return c[POSITION.GK] >= 1 && c[POSITION.DEF] >= 3 && c[POSITION.MID] >= 3 && c[POSITION.FWD] >= 1;
};

/**
 * Return a human-readable formation violation message, or null if valid.
 * @param {Array} activePlayers
 * @returns {string|null}
 */
const getFormationError = (activePlayers) => {
  const c = countPositions(activePlayers);
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
 *   - Must be a cross-zone swap (active ↔ reserve)
 *   - Managers cannot be substituted (they can only be transferred)
 *   - GK can only swap with GK
 *   - Resulting formation must satisfy ≥1 GK, ≥3 DEF, ≥3 MID, ≥1 FWD
 *   - Both players must be found in their stated zones
 *
 * @param {Object} player1
 * @param {Object} player2
 * @param {string} zone1 - 'active' or 'reserve'
 * @param {string} zone2 - 'active' or 'reserve'
 * @param {Array}  activePlayers  - Starting XI
 * @param {Array}  reservePlayers - Bench
 * @returns {{ valid: boolean, error: string }}
 */
const validateSubstitution = (player1, player2, zone1, zone2, activePlayers, reservePlayers) => {
  if (zone1 === zone2) {
    return {
      valid: false,
      error: 'Players can only be swapped between the active squad and the reserve.',
    };
  }

  const pos1 = getPosition(player1);
  const pos2 = getPosition(player2);

  // Managers can only be transferred, not substituted.
  if (pos1 === POSITION.MANAGER || pos2 === POSITION.MANAGER) {
    return { valid: false, error: 'Managers cannot be substituted — use a transfer instead.' };
  }

  if (pos1 === POSITION.GK || pos2 === POSITION.GK) {
    if (pos1 !== pos2) {
      return { valid: false, error: 'Goalkeepers can only be swapped with other goalkeepers.' };
    }
  }

  const z1 = zone1 === 'active' ? activePlayers : reservePlayers;
  const z2 = zone2 === 'active' ? activePlayers : reservePlayers;

  const idx1 = z1.findIndex((p) => p.code === player1.code);
  const idx2 = z2.findIndex((p) => p.code === player2.code);

  if (idx1 === -1 || idx2 === -1) {
    return { valid: false, error: 'Player not found in their designated team zone.' };
  }

  // Simulate the swap and verify the resulting formation.
  const newActive  = [...activePlayers];
  const newReserve = [...reservePlayers];

  if (zone1 === 'active') {
    newActive[idx1]  = player2;
    newReserve[idx2] = player1;
  } else {
    newReserve[idx1] = player2;
    newActive[idx2]  = player1;
  }

  const formationError = getFormationError(newActive);
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
