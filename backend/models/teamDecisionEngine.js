'use strict';

/**
 * Team Decision Engine
 *
 * Produces weekly recommendations for the FPL Predictor's managed team:
 *   - Transfer suggestions (1–2 players)
 *   - Captain / vice-captain selection
 *   - Optimal starting lineup and bench order
 *   - Chip suggestions
 *
 * All logic is deterministic and read-only — it never submits anything.
 * Reuses the existing prediction infrastructure (ep_next already computed).
 */

const MAX_PLAYERS_PER_CLUB = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────

const ep = (player) => {
  const v = parseFloat(player.ep_next ?? player.computed_ep_next ?? 0);
  return Number.isFinite(v) ? v : 0;
};

const posLabel = (type) => ({ 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }[type] || '?');

// ── Captain recommendation ────────────────────────────────────────────────────

/**
 * Recommend captain and vice-captain from the active XI.
 *
 * @param {Object[]} activePlayers
 * @returns {{ captain: Object, viceCaptain: Object, captainReason: string, vcReason: string }}
 */
function recommendCaptain(activePlayers) {
  const outfield = activePlayers.filter(p => p.element_type !== 1);
  if (!outfield.length) return { captain: null, viceCaptain: null, captainReason: '', vcReason: '' };

  const sorted = [...outfield].sort((a, b) => ep(b) - ep(a));
  const captain    = sorted[0];
  const viceCaptain = sorted[1] || null;

  const captainReason = `Highest predicted score (${ep(captain).toFixed(1)} pts) among starting outfield players.`;
  const vcReason = viceCaptain
    ? `Second-highest predicted score (${ep(viceCaptain).toFixed(1)} pts).`
    : '';

  return { captain, viceCaptain, captainReason, vcReason };
}

// ── Lineup recommendation ─────────────────────────────────────────────────────

/**
 * Determine the optimal starting XI and bench order from a 15-player squad,
 * observing FPL formation rules (1 GK, 3–5 DEF, 2–5 MID, 1–3 FWD).
 *
 * @param {Object[]} squad   - 15 enriched player objects (ep_next already set)
 * @returns {{ activePlayers: Object[], reservePlayers: Object[] }}
 */
function recommendLineup(squad) {
  const byPos = (type) =>
    squad.filter(p => p.element_type === type).sort((a, b) => ep(b) - ep(a));

  const gks  = byPos(1);
  const defs = byPos(2);
  const mids = byPos(3);
  const fwds = byPos(4);

  // Start with the minimum required players per position
  const startingGK  = gks.slice(0, 1);
  const benchGK     = gks.slice(1);

  let startDefs = defs.slice(0, 3);
  let startMids = mids.slice(0, 2);
  let startFwds = fwds.slice(0, 1);

  const benchPool = [
    ...defs.slice(3),
    ...mids.slice(2),
    ...fwds.slice(1),
  ].sort((a, b) => ep(b) - ep(a));

  // Fill remaining 4 outfield slots from highest-EP bench candidates
  // while respecting position maximums
  const maxDef = 5, maxMid = 5, maxFwd = 3;
  const remaining = [...benchPool];

  while ((startDefs.length + startMids.length + startFwds.length) < 10 && remaining.length) {
    const candidate = remaining.shift();
    if (!candidate) break;
    if (candidate.element_type === 2 && startDefs.length < maxDef) startDefs.push(candidate);
    else if (candidate.element_type === 3 && startMids.length < maxMid) startMids.push(candidate);
    else if (candidate.element_type === 4 && startFwds.length < maxFwd) startFwds.push(candidate);
    else remaining.push(candidate); // put back at tail if position full
  }

  // Re-sort positions by EP desc
  startDefs.sort((a, b) => ep(b) - ep(a));
  startMids.sort((a, b) => ep(b) - ep(a));
  startFwds.sort((a, b) => ep(b) - ep(a));

  const activePlayers = [...startingGK, ...startDefs, ...startMids, ...startFwds];
  const usedIds = new Set(activePlayers.map(p => p.id));
  const reservePlayers = [
    ...benchGK,
    ...squad.filter(p => !usedIds.has(p.id)).sort((a, b) => ep(b) - ep(a)),
  ];

  return { activePlayers, reservePlayers };
}

// ── Transfer recommendation ───────────────────────────────────────────────────

/**
 * Recommend up to `maxTransfers` transfers.
 *
 * Strategy:
 *   1. For each squad player, identify the best replacement from the full
 *      player pool that improves EP, fits within the remaining budget, and
 *      does not violate club limits.
 *   2. Rank candidate swaps by EP gain descending.
 *   3. Return the top `maxTransfers` non-conflicting swaps.
 *
 * @param {Object[]} squad         - Current 15-player squad
 * @param {Object[]} allPlayers    - All enriched FPL players
 * @param {number}   bank          - Available budget in FPL units (tenths of £m)
 * @param {number}   freeTransfers - Number of free transfers available
 * @param {number}   maxTransfers  - Maximum swaps to return (default 2)
 * @returns {Array}                - Array of swap objects
 */
function recommendTransfers(squad, allPlayers, bank, freeTransfers, maxTransfers = 2) {
  const squadIds = new Set(squad.map(p => p.id));
  const squadTeamCounts = {};
  squad.forEach(p => { squadTeamCounts[p.team] = (squadTeamCounts[p.team] || 0) + 1; });

  // Candidates outside the squad, sorted by EP desc
  const pool = allPlayers
    .filter(p => !squadIds.has(p.id) && p.element_type >= 1 && p.element_type <= 4 && p.now_cost > 0)
    .sort((a, b) => ep(b) - ep(a));

  const swaps = [];

  for (const playerOut of squad) {
    const budget = (playerOut.selling_price ?? playerOut.now_cost) + bank;
    const teamCountsWithoutOut = { ...squadTeamCounts };
    teamCountsWithoutOut[playerOut.team] = Math.max(0, (teamCountsWithoutOut[playerOut.team] || 0) - 1);

    for (const playerIn of pool) {
      if (playerIn.element_type !== playerOut.element_type) continue;
      if (playerIn.now_cost > budget) continue;
      const club = playerIn.team;
      if ((teamCountsWithoutOut[club] || 0) >= MAX_PLAYERS_PER_CLUB) continue;

      const epGain = ep(playerIn) - ep(playerOut);
      if (epGain <= 0) continue;

      swaps.push({
        playerOut: { id: playerOut.id, web_name: playerOut.web_name, element_type: playerOut.element_type, team: playerOut.team, ep: ep(playerOut), selling_price: playerOut.selling_price ?? playerOut.now_cost, now_cost: playerOut.now_cost },
        playerIn:  { id: playerIn.id,  web_name: playerIn.web_name,  element_type: playerIn.element_type,  team: playerIn.team,  ep: ep(playerIn),  now_cost: playerIn.now_cost },
        epGain,
        costDelta: playerIn.now_cost - (playerOut.selling_price ?? playerOut.now_cost),
        isFree: swaps.length < freeTransfers,
        pointsCost: Math.max(0, (swaps.length + 1 - freeTransfers) * 4),
        reason: `${playerIn.web_name} (${posLabel(playerIn.element_type)}, ${(playerIn.now_cost / 10).toFixed(1)}m) is predicted ${epGain.toFixed(1)} pts better than ${playerOut.web_name} for this gameweek.`,
      });
      break; // best replacement per outgoing player found
    }
  }

  // Sort by EP gain / cost efficiency, then deduplicate to avoid using the same
  // playerIn twice across recommended swaps
  swaps.sort((a, b) => b.epGain - a.epGain);

  const result = [];
  const usedIn  = new Set();
  const usedOut = new Set();

  for (const swap of swaps) {
    if (result.length >= maxTransfers) break;
    if (usedOut.has(swap.playerOut.id) || usedIn.has(swap.playerIn.id)) continue;
    result.push(swap);
    usedOut.add(swap.playerOut.id);
    usedIn.add(swap.playerIn.id);
  }

  return result.map((swap, idx) => ({
    ...swap,
    isFree: idx < freeTransfers,
    pointsCost: idx < freeTransfers ? 0 : (idx + 1 - freeTransfers) * 4,
  }));
}

// ── Chip recommendation ───────────────────────────────────────────────────────

/**
 * Suggest a chip based on squad state.
 *
 * Simple heuristics:
 *   - Bench Boost: bench has high total EP (> 20 pts combined)
 *   - Triple Captain: captain has very high EP (>= 12 pts)
 *   - Wildcard: squad has many low-EP players (average squad EP < 5 pts)
 *   - Free Hit: not recommended automatically (complex to reason about)
 *
 * @param {Object[]} activePlayers
 * @param {Object[]} reservePlayers
 * @param {Object[]} usedChips        - Array of chip names already used in FPL
 * @returns {{ chip: string|null, reason: string }}
 */
function recommendChip(activePlayers, reservePlayers, usedChips = []) {
  const usedSet = new Set(usedChips);

  // Triple Captain
  const captain = [...activePlayers].sort((a, b) => ep(b) - ep(a)).find(p => p.element_type !== 1);
  if (captain && ep(captain) >= 12 && !usedSet.has('3xc')) {
    return { chip: 'triple_captain', reason: `${captain.web_name} has an exceptional predicted score of ${ep(captain).toFixed(1)} pts — Triple Captain could yield ${(ep(captain) * 3).toFixed(0)} pts from the captain slot.` };
  }

  // Bench Boost
  const benchEp = reservePlayers.reduce((sum, p) => sum + ep(p), 0);
  if (benchEp >= 20 && !usedSet.has('bboost')) {
    return { chip: 'bench_boost', reason: `Bench has a combined predicted score of ${benchEp.toFixed(1)} pts — Bench Boost could add significant returns.` };
  }

  // Wildcard: squad has weak average EP
  const avgEp = [...activePlayers, ...reservePlayers].reduce((s, p) => s + ep(p), 0) / 15;
  if (avgEp < 4.5 && !usedSet.has('wildcard')) {
    return { chip: 'wildcard', reason: `Squad average predicted score is low (${avgEp.toFixed(1)} pts/player). A Wildcard could allow a full squad overhaul.` };
  }

  return { chip: null, reason: 'No chip is recommended this gameweek.' };
}

module.exports = {
  recommendCaptain,
  recommendLineup,
  recommendTransfers,
  recommendChip,
};
