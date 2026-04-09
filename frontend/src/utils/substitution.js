/**
 * FPL Substitution Logic — pure, side-effect-free functions (ES module).
 *
 * Position codes mirror the FPL API:
 *   1 = GK, 2 = DEF, 3 = MID, 4 = FWD, 5 = Manager placeholder
 *
 * Zone terminology:
 *   'active'  — the starting XI
 *   'reserve' — the bench
 *
 * Frontend player objects use `position` (mapped from element_type during
 * formatting in useTeamData.js).  The helpers fall back to element_type so
 * the same functions work with both backend- and frontend-shaped objects.
 */

export const POSITION = Object.freeze({ GK: 1, DEF: 2, MID: 3, FWD: 4, MANAGER: 5 });

/** Extract the position code from a player object. */
const getPosition = (player) => player.position || player.element_type || 0;

/**
 * Count players at each position in the active (starting) XI, ignoring manager slots.
 * @param {Array} activePlayers
 * @returns {{ [posCode]: number }}
 */
export const countPositions = (activePlayers) => {
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
 * @param {Array} activePlayers
 * @returns {boolean}
 */
export const isValidFormation = (activePlayers) => {
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
 *   - Managers cannot be substituted (they can only be transferred)
 *   - GK can only swap with GK
 *   - Cross-zone (active↔reserve) swaps must produce a valid formation
 *     (≥1 GK, ≥3 DEF, ≥3 MID, ≥1 FWD)
 *   - Both players must be found in their stated zones (matched by `code`)
 *
 * @param {Object} player1
 * @param {Object} player2
 * @param {string} zone1 - 'active' or 'reserve'
 * @param {string} zone2 - 'active' or 'reserve'
 * @param {Array}  activePlayers  - Starting XI
 * @param {Array}  reservePlayers - Bench
 * @returns {{ valid: boolean, error: string }}
 */
export const validateSubstitution = (player1, player2, zone1, zone2, activePlayers, reservePlayers) => {
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

  const activeZone1  = zone1 === 'active' ? activePlayers : reservePlayers;
  const activeZone2  = zone2 === 'active' ? activePlayers : reservePlayers;

  const idx1 = activeZone1.findIndex((p) => p.code === player1.code);
  const idx2 = activeZone2.findIndex((p) => p.code === player2.code);

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
 * Prefers the explicit `basePoints` field; otherwise reverses the multiplier.
 */
const getBase = (p) =>
  p.basePoints != null
    ? p.basePoints
    : Math.round((p.predictedPoints ?? 0) / (p.multiplier || 1));

/**
 * Apply a validated substitution to the squad, handling captain/vice-captain
 * transfers when either role-holder leaves the active XI.
 *
 * Returns new { activePlayers, reservePlayers } arrays without mutating the originals.
 * The incoming player **inherits the exact slot** of the outgoing player.
 *
 * @param {Array}  activePlayers  - Starting XI
 * @param {Array}  reservePlayers - Bench
 * @param {Object} player1
 * @param {Object} player2
 * @param {string} zone1 - 'active' or 'reserve'
 * @param {string} zone2 - 'active' or 'reserve'
 * @returns {{ activePlayers: Array, reservePlayers: Array }}
 */
export const applySubstitution = (activePlayers, reservePlayers, player1, player2, zone1, zone2) => {
  const newActive  = [...activePlayers];
  const newReserve = [...reservePlayers];

  // Work against the mutable copies so indexes stay valid.
  const z1 = zone1 === 'active' ? newActive : newReserve;
  const z2 = zone2 === 'active' ? newActive : newReserve;

  const idx1 = z1.findIndex((p) => p.code === player1.code);
  const idx2 = z2.findIndex((p) => p.code === player2.code);

  if (idx1 === -1 || idx2 === -1) {
    return { activePlayers, reservePlayers };
  }

  // Identify the player leaving the active XI and the one coming in.
  const outPlayer = zone1 === 'active' ? player1 : player2;
  const inPlayer  = zone1 === 'reserve' ? player1 : player2;

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
      // p2 is the outgoing captain; p1 is the incoming player.
      p2 = { ...p2, is_captain: false, multiplier: 1, predictedPoints: outBase };
      p1 = { ...p1, is_captain: true,  multiplier: 2, predictedPoints: inBase * 2 };
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
  z1[idx1] = p2;
  z2[idx2] = p1;

  return { activePlayers: newActive, reservePlayers: newReserve };
};

/**
 * Select the optimal starting XI from a full squad of 15 players.
 *
 * Algorithm:
 *   1. Best GK (by base points) starts; the other GK goes to bench.
 *   2. Mandatory outfield starters: top 3 DEF + top 3 MID + top 1 FWD = 7 players.
 *   3. 3 flex slots filled from the remaining outfield pool (sorted by base points).
 *   4. Captain: highest-base-points outfield (non-GK, non-manager) starter.
 *   5. Vice-captain: second-highest-base-points outfield starter.
 *   6. Manager placeholders are preserved unchanged and placed at activePlayers[0].
 *
 * @param {Array} allPlayers - All 15 squad members (starting XI + bench combined).
 * @returns {{ activePlayers: Array, reservePlayers: Array }}
 */
export const selectOptimalLineup = (allPlayers) => {
  const pos = (p) => p.position || p.element_type || 0;
  // Use base points for sorting so that the current captain's 2× multiplier
  // does not unfairly influence who starts.
  const sortDesc = (arr) => [...arr].sort((a, b) => getBase(b) - getBase(a));

  // Extract manager placeholders first so they are never dropped from the squad.
  // The first manager (if any) is placed at the front of activePlayers to match
  // TeamFormation's expectation; any further managers go onto the bench.
  const managers = allPlayers.filter(p => pos(p) === POSITION.MANAGER);
  const nonManagers = allPlayers.filter(p => pos(p) !== POSITION.MANAGER);

  const gks  = sortDesc(nonManagers.filter(p => pos(p) === POSITION.GK));
  const defs = sortDesc(nonManagers.filter(p => pos(p) === POSITION.DEF));
  const mids = sortDesc(nonManagers.filter(p => pos(p) === POSITION.MID));
  const fwds = sortDesc(nonManagers.filter(p => pos(p) === POSITION.FWD));

  // Mandatory starters: 1 GK + 3 DEF + 3 MID + 1 FWD
  const startingGk = gks[0];
  const mandatoryStarters = [
    ...defs.slice(0, 3),
    ...mids.slice(0, 3),
    ...fwds.slice(0, 1),
  ];

  // Flex pool: remaining outfield players sorted by base points descending
  const flexPool = sortDesc([
    ...defs.slice(3),
    ...mids.slice(3),
    ...fwds.slice(1),
  ]);

  // 3 flex starters to reach a total of 11 (1 GK + 7 mandatory + 3 flex)
  const flexStarters  = flexPool.slice(0, 3);
  const benchOutfield = flexPool.slice(3);

  const startingXI = [startingGk, ...mandatoryStarters, ...flexStarters].filter(Boolean);
  // Sort starting XI by position (GK > DEF > MID > FWD) for consistent display ordering
  const positionOrder = (p) => pos(p);
  const sortedStartingXI = [...startingXI].sort((a, b) => positionOrder(a) - positionOrder(b));
  const bench = [gks[1], ...benchOutfield].filter(Boolean);

  // Captain: highest base-points outfield (non-GK, non-manager) starter
  const outfieldStarters = sortedStartingXI.filter(
    p => pos(p) !== POSITION.GK && pos(p) !== POSITION.MANAGER,
  );
  if (outfieldStarters.length === 0) {
    // Re-attach managers and return without assigning captaincy
    return {
      activePlayers: [...managers.slice(0, 1), ...sortedStartingXI].filter(Boolean),
      reservePlayers: [...bench, ...managers.slice(1)].filter(Boolean),
    };
  }

  const captainPlayer = outfieldStarters.reduce((best, p) =>
    getBase(p) > getBase(best) ? p : best
  );

  // Vice-captain: second-highest base-points outfield starter
  const nonCaptain = outfieldStarters.filter(p => p.code !== captainPlayer.code);
  const vcPlayer = nonCaptain.length > 0
    ? nonCaptain.reduce((best, p) => getBase(p) > getBase(best) ? p : best)
    : null;

  // Apply captain / vice-captain roles and reset multipliers
  const applyRoles = (players) =>
    players.map((p) => {
      // Leave manager placeholders untouched
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

  // Re-attach managers: first manager at the front of activePlayers (TeamFormation
  // expects manager at index 0 when present); any extra managers go on the bench.
  const activeManagers  = managers.slice(0, 1);
  const reserveManagers = managers.slice(1);

  return {
    activePlayers: applyRoles([...activeManagers, ...sortedStartingXI]),
    reservePlayers: applyRoles([...bench, ...reserveManagers]),
  };
};

/**
 * Calculate the score breakdown for a squad.
 * The captain's predictedPoints are already doubled (multiplier applied during
 * formatting), so total is simply the sum of all active XI predictedPoints.
 *
 * @param {Array} activePlayers  - Starting XI
 * @param {Array} reservePlayers - Bench players
 * @returns {{ totalPoints: number, reservePoints: number }}
 */
export const calculateScore = (activePlayers, reservePlayers) => {
  const totalPoints   = activePlayers.reduce((sum, p) => sum + (p.predictedPoints ?? 0), 0);
  const reservePoints = reservePlayers.reduce((sum, p) => sum + (p.predictedPoints ?? 0), 0);
  return { totalPoints, reservePoints };
};

/**
 * Ensure captaincy is always held by an active XI player (auto-correction for
 * corrupted state).  If the captain is on the reserve, the vice-captain in the
 * active XI is promoted to captain and a new vice is picked automatically.
 *
 * @param {Array} activePlayers
 * @param {Array} reservePlayers
 * @returns {{ activePlayers: Array, reservePlayers: Array }}
 */
export const normalizeCaptaincy = (activePlayers, reservePlayers) => {
  const captainInActive = activePlayers.some((p) => p.is_captain);
  if (captainInActive) return { activePlayers, reservePlayers };

  const viceInActive = activePlayers.find((p) => p.is_vice_captain);
  if (!viceInActive) return { activePlayers, reservePlayers };

  const viceBase = getBase(viceInActive);

  // Strip captain from reserve; promote vice to captain in active XI.
  const newReserve = reservePlayers.map((p) =>
    p.is_captain ? { ...p, is_captain: false, multiplier: 1 } : p
  );
  let newActive = activePlayers.map((p) =>
    p.is_vice_captain
      ? { ...p, is_captain: true, is_vice_captain: false, multiplier: 2, predictedPoints: viceBase * 2 }
      : p
  );

  // Pick the new vice: highest base-points non-captain active player.
  const candidates = newActive.filter((p) => !p.is_captain && p.position !== POSITION.GK);
  const newVice = candidates.length > 0
    ? candidates.reduce((best, p) => getBase(p) > getBase(best) ? p : best)
    : null;

  if (newVice) {
    newActive = newActive.map((p) => ({ ...p, is_vice_captain: p.code === newVice.code }));
  }

  return { activePlayers: newActive, reservePlayers: newReserve };
};
