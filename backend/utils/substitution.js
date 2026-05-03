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
 * Validate whether swapping player1 ↔ player2 is legal.
 *
 * Rules enforced:
 *   - Active-active swaps are not permitted (no meaningful formation change).
 *   - Bench-bench (reserve↔reserve) swaps are allowed to enable bench re-ordering /
 *     sideways substitutions, subject to the GK and Manager constraints below.
 *   - Managers cannot be substituted (they can only be transferred).
 *   - GK can only swap with GK.
 *   - Cross-zone (active↔reserve) swaps must produce a valid formation
 *     (≥1 GK, ≥3 DEF, ≥3 MID, ≥1 FWD).
 *   - Both players must be found in their stated zones.
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
  // Reject any zone string that isn't one of the two valid values.
  if (zone1 !== 'active' && zone1 !== 'reserve') {
    return { valid: false, error: `Invalid zone '${zone1}'. Must be 'active' or 'reserve'.` };
  }
  if (zone2 !== 'active' && zone2 !== 'reserve') {
    return { valid: false, error: `Invalid zone '${zone2}'. Must be 'active' or 'reserve'.` };
  }

  const pos1 = getPosition(player1);
  const pos2 = getPosition(player2);

  // Managers can only be transferred, not substituted.
  if (pos1 === POSITION.MANAGER || pos2 === POSITION.MANAGER) {
    return { valid: false, error: 'Managers cannot be substituted — use a transfer instead.' };
  }

  if (zone1 === zone2) {
    if (zone1 === 'active') {
      return {
        valid: false,
        error: 'Players in the starting XI cannot be swapped with each other.',
      };
    }

    // zone1 === zone2 === 'reserve': bench re-ordering path.
    // GK can only swap with another GK on the bench.
    if ((pos1 === POSITION.GK || pos2 === POSITION.GK) && pos1 !== pos2) {
      return { valid: false, error: 'Goalkeepers can only be swapped with other goalkeepers.' };
    }

    const idx1 = reservePlayers.findIndex((p) => p.code === player1.code);
    const idx2 = reservePlayers.findIndex((p) => p.code === player2.code);

    if (idx1 === -1 || idx2 === -1) {
      return { valid: false, error: 'Player not found in their designated team zone.' };
    }

    return { valid: true, error: '' };
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

/**
 * Derive a player's base (uncaptained) points.
 */
const getBase = (p) =>
  p.basePoints != null
    ? p.basePoints
    : Math.round((p.predictedPoints ?? 0) / (p.multiplier || 1));

/**
 * Apply a validated substitution.
 * Returns new { activePlayers, reservePlayers } without mutating originals.
 */
const applySubstitution = (activePlayers, reservePlayers, player1, player2, zone1, zone2) => {
  const newActive  = [...activePlayers];
  const newReserve = [...reservePlayers];

  const z1 = zone1 === 'active' ? newActive : newReserve;
  const z2 = zone2 === 'active' ? newActive : newReserve;

  const idx1 = z1.findIndex((p) => p.code === player1.code);
  const idx2 = z2.findIndex((p) => p.code === player2.code);

  if (idx1 === -1 || idx2 === -1) return { activePlayers, reservePlayers };

  const outPlayer = zone1 === 'active' ? player1 : player2;
  const inPlayer  = zone1 === 'reserve' ? player1 : player2;

  let p1 = { ...player1 };
  let p2 = { ...player2 };

  if (outPlayer.is_captain) {
    const outBase = Math.round(getBase(outPlayer));
    const inBase  = Math.round(getBase(inPlayer));
    if (p1.code === outPlayer.code) {
      p1 = { ...p1, is_captain: false, multiplier: 1, predictedPoints: outBase };
      p2 = { ...p2, is_captain: true,  multiplier: 2, predictedPoints: inBase * 2 };
    } else {
      p2 = { ...p2, is_captain: false, multiplier: 1, predictedPoints: outBase };
      p1 = { ...p1, is_captain: true,  multiplier: 2, predictedPoints: inBase * 2 };
    }
  }

  if (outPlayer.is_vice_captain && !outPlayer.is_captain) {
    if (p1.code === outPlayer.code) {
      p1 = { ...p1, is_vice_captain: false };
      p2 = { ...p2, is_vice_captain: true };
    } else {
      p2 = { ...p2, is_vice_captain: false };
      p1 = { ...p1, is_vice_captain: true };
    }
  }

  z1[idx1] = p2;
  z2[idx2] = p1;

  return { activePlayers: newActive, reservePlayers: newReserve };
};

/**
 * Select the optimal starting XI from a full squad of 15 players.
 *
 * Algorithm:
 *   1. Best GK (by base points) starts; other GK goes to bench.
 *   2. Mandatory: top 3 DEF + top 3 MID + top 1 FWD = 7 outfield starters.
 *   3. 3 flex slots from remaining outfield pool.
 *   4. Captain: highest base-points outfield starter.
 *   5. Vice-captain: second-highest.
 *
 * @param {Array} allPlayers - All 15 squad members combined.
 * @returns {{ activePlayers: Array, reservePlayers: Array }}
 */
const selectOptimalLineup = (allPlayers) => {
  const pos = (p) => getPosition(p);
  const sortDesc = (arr) => [...arr].sort((a, b) => getBase(b) - getBase(a));

  const managers    = allPlayers.filter(p => pos(p) === POSITION.MANAGER);
  const nonManagers = allPlayers.filter(p => pos(p) !== POSITION.MANAGER);

  const gks  = sortDesc(nonManagers.filter(p => pos(p) === POSITION.GK));
  const defs = sortDesc(nonManagers.filter(p => pos(p) === POSITION.DEF));
  const mids = sortDesc(nonManagers.filter(p => pos(p) === POSITION.MID));
  const fwds = sortDesc(nonManagers.filter(p => pos(p) === POSITION.FWD));

  const startingGk       = gks[0];
  const mandatoryStarters = [...defs.slice(0, 3), ...mids.slice(0, 3), ...fwds.slice(0, 1)];
  const flexPool         = sortDesc([...defs.slice(3), ...mids.slice(3), ...fwds.slice(1)]);
  const flexStarters     = flexPool.slice(0, 3);
  const benchOutfield    = flexPool.slice(3);

  const startingXI = [startingGk, ...mandatoryStarters, ...flexStarters].filter(Boolean);
  const sortedXI   = [...startingXI].sort((a, b) => pos(a) - pos(b));
  const bench      = [gks[1], ...benchOutfield].filter(Boolean);

  const outfieldStarters = sortedXI.filter(p => pos(p) !== POSITION.GK && pos(p) !== POSITION.MANAGER);
  if (outfieldStarters.length === 0) {
    return {
      activePlayers:  [...managers.slice(0, 1), ...sortedXI].filter(Boolean),
      reservePlayers: [...bench, ...managers.slice(1)].filter(Boolean),
    };
  }

  const captainPlayer = outfieldStarters.reduce((best, p) => getBase(p) > getBase(best) ? p : best);
  const nonCaptain    = outfieldStarters.filter(p => p.code !== captainPlayer.code);
  const vcPlayer      = nonCaptain.length > 0
    ? nonCaptain.reduce((best, p) => getBase(p) > getBase(best) ? p : best)
    : null;

  const applyRoles = (players) =>
    players.map((p) => {
      if (pos(p) === POSITION.MANAGER) return p;
      const base = Math.round(getBase(p));
      if (p.code === captainPlayer.code) {
        return { ...p, is_captain: true, is_vice_captain: false, multiplier: 2, predictedPoints: base * 2 };
      }
      if (vcPlayer && p.code === vcPlayer.code) {
        return { ...p, is_captain: false, is_vice_captain: true, multiplier: 1, predictedPoints: base };
      }
      return { ...p, is_captain: false, is_vice_captain: false, multiplier: 1, predictedPoints: base };
    });

  return {
    activePlayers:  applyRoles([...managers.slice(0, 1), ...sortedXI]),
    reservePlayers: applyRoles([...bench, ...managers.slice(1)]),
  };
};

module.exports = {
  POSITION,
  getPosition,
  countPositions,
  isValidFormation,
  getFormationError,
  validateSubstitution,
  applySubstitution,
  selectOptimalLineup,
};
