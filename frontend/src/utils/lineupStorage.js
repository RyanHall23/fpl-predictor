/**
 * Persist a user's team lineup selection (starting XI / bench order / captain)
 * to localStorage so it survives page refreshes.
 *
 * The stored data is keyed by entryId + gameweek and includes a "fingerprint"
 * of the 15 player codes in the squad.  If the fingerprint no longer matches
 * the live squad (because a transfer was made since the data was saved), the
 * stored selection is discarded and the fresh API data is used instead.
 *
 * Only future gameweeks are persisted — past and active (locked) gameweeks
 * always use the FPL API response as the authoritative source.
 */

const STORAGE_VERSION = 1;

function storageKey(entryId, gameweek) {
  return `fpl_lineup_v${STORAGE_VERSION}_${entryId}_${gameweek}`;
}

/** Sorted array of all 15 player codes — used to detect squad changes. */
function buildFingerprint(activePlayers, reservePlayers) {
  return [...activePlayers, ...reservePlayers]
    .map((p) => p.code)
    .sort((a, b) => a - b);
}

/**
 * Save the current lineup to localStorage.
 *
 * @param {string|number} entryId
 * @param {number}        gameweek
 * @param {Object[]}      activePlayers  - Starting XI player objects.
 * @param {Object[]}      reservePlayers - Bench player objects.
 */
export function saveLineup(entryId, gameweek, activePlayers, reservePlayers) {
  if (!entryId || !gameweek || activePlayers.length === 0) return;
  try {
    const allPlayers = [...activePlayers, ...reservePlayers];
    const captainCode = activePlayers.find((p) => p.is_captain)?.code ?? null;
    const viceCaptainCode = allPlayers.find((p) => p.is_vice_captain)?.code ?? null;

    const data = {
      fingerprint: buildFingerprint(activePlayers, reservePlayers),
      activePlayerCodes: activePlayers.map((p) => ({ code: p.code, slot: p.slot })),
      reservePlayerCodes: reservePlayers.map((p) => ({ code: p.code, slot: p.slot })),
      captainCode,
      viceCaptainCode,
    };
    localStorage.setItem(storageKey(entryId, gameweek), JSON.stringify(data));
  } catch {
    // localStorage can fail (quota exceeded, private mode, etc.) — silently ignore.
  }
}

/**
 * Load a previously saved lineup snapshot.
 *
 * @param {string|number} entryId
 * @param {number}        gameweek
 * @returns {Object|null} Stored snapshot, or null if none exists.
 */
export function loadLineup(entryId, gameweek) {
  if (!entryId || !gameweek) return null;
  try {
    const raw = localStorage.getItem(storageKey(entryId, gameweek));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Remove a stored lineup snapshot (e.g. after gameweek locks).
 *
 * @param {string|number} entryId
 * @param {number}        gameweek
 */
export function clearLineup(entryId, gameweek) {
  if (!entryId || !gameweek) return;
  try {
    localStorage.removeItem(storageKey(entryId, gameweek));
  } catch {
    // ignore
  }
}

// ─── Chip storage ────────────────────────────────────────────────────────────
// Stored separately from the lineup so chip selections can be toggled
// independently (e.g. before any subs have been made).

function chipStorageKey(entryId, gameweek) {
  return `fpl_chip_v${STORAGE_VERSION}_${entryId}_${gameweek}`;
}

/**
 * Save the user's planned chip selection for a future gameweek.
 * Passing null clears the stored value.
 *
 * @param {string|number}  entryId
 * @param {number}         gameweek
 * @param {string|null}    chipId   - e.g. 'bench_boost', 'triple_captain', or null to clear.
 */
export function saveChip(entryId, gameweek, chipId) {
  if (!entryId || !gameweek) return;
  try {
    if (chipId) {
      localStorage.setItem(chipStorageKey(entryId, gameweek), chipId);
    } else {
      localStorage.removeItem(chipStorageKey(entryId, gameweek));
    }
  } catch {
    // ignore
  }
}

/**
 * Load a previously saved chip selection for a future gameweek.
 *
 * @param {string|number} entryId
 * @param {number}        gameweek
 * @returns {string|null} Chip id, or null if none stored.
 */
export function loadChip(entryId, gameweek) {
  if (!entryId || !gameweek) return null;
  try {
    return localStorage.getItem(chipStorageKey(entryId, gameweek)) || null;
  } catch {
    return null;
  }
}

/**
 * Attempt to reconstruct a lineup from a stored snapshot using freshly-fetched
 * player objects (which carry up-to-date predicted points, form, etc.).
 *
 * Returns null if the squad composition has changed since the snapshot was
 * saved (indicating a transfer was made), in which case the caller should fall
 * back to the plain API data.
 *
 * @param {Object[]}   freshActive    - Starting XI returned by the API (used for player objects).
 * @param {Object[]}   freshReserve   - Bench returned by the API (used for player objects).
 * @param {Object}     stored         - Snapshot previously returned by loadLineup().
 * @param {Set<number>} [baseCodesSet] - Set of player codes from the last known actual squad
 *   (e.g. current GW picks).  When provided this is used for the fingerprint comparison
 *   instead of freshActive + freshReserve.  This ensures that a re-optimised future-GW
 *   response (same 15 players, different predicted-point ordering) cannot mask a real
 *   transfer that changed the squad composition.
 * @returns {{ activePlayers: Object[], reservePlayers: Object[] } | null}
 */
export function restoreLineup(freshActive, freshReserve, stored, baseCodesSet) {
  if (!stored) return null;

  const allFresh = [...freshActive, ...freshReserve];

  // Use the caller-supplied base squad codes when available (current/last GW
  // actual picks), otherwise fall back to the future-GW player list.
  const comparisonCodeSet = baseCodesSet ?? new Set(allFresh.map((p) => p.code));

  // Any mismatch means a transfer happened — do not restore.
  if (
    comparisonCodeSet.size !== stored.fingerprint.length ||
    stored.fingerprint.some((code) => !comparisonCodeSet.has(code))
  ) {
    return null;
  }

  const playerMap = Object.fromEntries(allFresh.map((p) => [p.code, p]));

  // Derive base points for captain multiplier (undo any existing 2× multiplier).
  const getBase = (p) =>
    p.basePoints != null
      ? p.basePoints
      : Math.round((p.predictedPoints ?? 0) / (p.multiplier || 1));

  const newActive = stored.activePlayerCodes
    .map(({ code, slot }) => {
      const p = playerMap[code];
      if (!p) return null;
      const isCapt = code === stored.captainCode;
      const isVC   = code === stored.viceCaptainCode;
      const base   = getBase(p);
      return {
        ...p,
        isActive: true,
        slot,
        is_captain: isCapt,
        is_vice_captain: isVC,
        multiplier: isCapt ? 2 : 1,
        basePoints: base,
        predictedPoints: isCapt ? base * 2 : base,
      };
    })
    .filter(Boolean);

  const newReserve = stored.reservePlayerCodes
    .map(({ code, slot }) => {
      const p = playerMap[code];
      if (!p) return null;
      const isVC = code === stored.viceCaptainCode;
      return {
        ...p,
        isActive: false,
        slot,
        is_captain: false,
        is_vice_captain: isVC,
        multiplier: 1,
      };
    })
    .filter(Boolean);

  // Only return a valid result if every expected player was found.
  if (
    newActive.length !== stored.activePlayerCodes.length ||
    newReserve.length !== stored.reservePlayerCodes.length
  ) {
    return null;
  }

  return { activePlayers: newActive, reservePlayers: newReserve };
}
