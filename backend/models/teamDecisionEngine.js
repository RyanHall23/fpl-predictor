'use strict';

/**
 * Team Decision Engine
 *
 * Produces weekly and multi-gameweek recommendations for the FPL Predictor's
 * managed team:
 *   - Transfer suggestions ranked by multi-GW EP gain
 *   - Captain / vice-captain selection
 *   - Optimal starting lineup and bench order
 *   - Chip suggestions with DGW awareness
 *   - Season plan covering chip schedule and transfer outlook
 *
 * All logic is deterministic and read-only — it never submits anything.
 * Reuses the existing prediction infrastructure (ep_next already computed).
 */

const PLANNING_HORIZON    = 5;   // GWs to look ahead for transfer/chip decisions
const MAX_PLAYERS_PER_CLUB = 3;
const HIT_COST            = 4;   // Points deducted per transfer beyond free transfers

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Single-GW expected points for a player (next gameweek). */
const ep = (player) => {
  const v = parseFloat(player.ep_next ?? player.computed_ep_next ?? 0);
  return Number.isFinite(v) ? v : 0;
};

/**
 * Multi-GW EP: sum of predicted points over the planning horizon.
 * Falls back to ep_next × horizon when no multi-GW map is available.
 *
 * @param {Object} player
 * @param {Object|null} multiGwEpMap  playerId → { total, hasDgw, gwEp }
 */
const epMg = (player, multiGwEpMap) => {
  if (multiGwEpMap && multiGwEpMap[player.id]) {
    return multiGwEpMap[player.id].total;
  }
  return ep(player) * PLANNING_HORIZON;
};

const posLabel = (type) => ({ 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }[type] || '?');

/**
 * Return the first upcoming DGW (double gameweek) from specialGws with at
 * least minTeams teams playing twice, after currentGW.
 */
const findNextDgw = (specialGws, currentGW, minTeams = 4) => {
  return Object.entries(specialGws || {})
    .map(([gw, s]) => ({ gw: parseInt(gw), ...s }))
    .filter(s => s.gw > (currentGW ?? 0) && s.dgwTeams.length >= minTeams)
    .sort((a, b) => a.gw - b.gw)[0] ?? null;
};

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
  const usedIds = new Set([...activePlayers, ...benchGK].map(p => p.id));
  const reservePlayers = [
    ...benchGK,
    ...squad.filter(p => !usedIds.has(p.id)).sort((a, b) => ep(b) - ep(a)),
  ];

  return { activePlayers, reservePlayers };
}

// ── Transfer recommendation ───────────────────────────────────────────────────

/**
 * Recommend up to `maxTransfers` transfers using multi-GW EP planning.
 *
 * Strategy:
 *   1. Rank candidates by multi-GW EP gain over the planning horizon.
 *   2. Deduct hit cost (4 pts each) from net gain for non-free transfers.
 *   3. Flag DGW assets and include per-GW breakdown in the reason.
 *
 * @param {Object[]} squad
 * @param {Object[]} allPlayers    - All enriched FPL players
 * @param {number}   bank          - Available budget in FPL units
 * @param {number}   freeTransfers
 * @param {number}   [maxTransfers=2]
 * @param {Object}   [options]
 * @param {Object}   [options.multiGwEpMap]  playerId → { total, hasDgw, gwEp }
 * @param {Object}   [options.specialGws]    { [gw]: { dgwTeams, bgwTeams } }
 * @param {number}   [options.currentGW]
 * @returns {Array}
 */
function recommendTransfers(squad, allPlayers, bank, freeTransfers, maxTransfers = 2, options = {}) {
  const { multiGwEpMap = null, specialGws = {}, currentGW = null } = options;

  const squadIds = new Set(squad.map(p => p.id));
  const squadTeamCounts = {};
  squad.forEach(p => { squadTeamCounts[p.team] = (squadTeamCounts[p.team] || 0) + 1; });

  // Sort candidates by multi-GW EP descending
  const pool = allPlayers
    .filter(p => !squadIds.has(p.id) && p.element_type >= 1 && p.element_type <= 4 && p.now_cost > 0)
    .sort((a, b) => epMg(b, multiGwEpMap) - epMg(a, multiGwEpMap));

  const swaps = [];

  for (const playerOut of squad) {
    const budget = (playerOut.selling_price ?? playerOut.now_cost) + bank;
    const teamCountsWithoutOut = { ...squadTeamCounts };
    teamCountsWithoutOut[playerOut.team] = Math.max(0, (teamCountsWithoutOut[playerOut.team] || 0) - 1);

    for (const playerIn of pool) {
      if (playerIn.element_type !== playerOut.element_type) continue;
      if (playerIn.now_cost > budget) continue;
      if ((teamCountsWithoutOut[playerIn.team] || 0) >= MAX_PLAYERS_PER_CLUB) continue;

      const mgOut  = epMg(playerOut, multiGwEpMap);
      const mgIn   = epMg(playerIn,  multiGwEpMap);
      const epGain = mgIn - mgOut;
      if (epGain <= 0) continue;

      const inDgw  = (multiGwEpMap?.[playerIn.id]?.hasDgw?.length  ?? 0) > 0;
      const outDgw = (multiGwEpMap?.[playerOut.id]?.hasDgw?.length ?? 0) > 0;
      const singleGwGain = ep(playerIn) - ep(playerOut);

      const reasonParts = [
        `${playerIn.web_name} (${posLabel(playerIn.element_type)}, £${(playerIn.now_cost / 10).toFixed(1)}m)`,
        `is predicted ${epGain.toFixed(1)} pts better than ${playerOut.web_name}`,
        `over the next ${PLANNING_HORIZON} GWs`,
      ];
      if (singleGwGain > 0.2) reasonParts.push(`(+${singleGwGain.toFixed(1)} pts next GW)`);
      if (inDgw) reasonParts.push('and has a Double Gameweek in the planning horizon');
      if (!inDgw && outDgw) reasonParts.push('(note: player out has a DGW — hold unless gain is substantial)');

      swaps.push({
        playerOut: {
          id: playerOut.id, web_name: playerOut.web_name,
          element_type: playerOut.element_type, team: playerOut.team,
          ep: ep(playerOut), ep_mg: mgOut,
          selling_price: playerOut.selling_price ?? playerOut.now_cost,
          now_cost: playerOut.now_cost, hasDgw: outDgw,
        },
        playerIn: {
          id: playerIn.id, web_name: playerIn.web_name,
          element_type: playerIn.element_type, team: playerIn.team,
          ep: ep(playerIn), ep_mg: mgIn,
          now_cost: playerIn.now_cost, hasDgw: inDgw,
        },
        epGain,
        epGainNextGw: singleGwGain,
        costDelta: playerIn.now_cost - (playerOut.selling_price ?? playerOut.now_cost),
        reason: reasonParts.join(' ') + '.',
      });
      break; // best replacement per outgoing player found
    }
  }

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

  return result.map((swap, idx) => {
    const pointsCost = idx < freeTransfers ? 0 : (idx + 1 - freeTransfers) * HIT_COST;
    return {
      ...swap,
      isFree:     idx < freeTransfers,
      pointsCost,
      netEpGain:  Math.round((swap.epGain - pointsCost) * 10) / 10,
    };
  });
}

// ── Chip recommendation ───────────────────────────────────────────────────────

/**
 * Suggest a chip with DGW/BGW awareness and multi-GW context.
 *
 * Priority order:
 *   1. Free Hit on a significant BGW (play a temporary XI)
 *   2. Triple Captain / save-TC advice around DGWs
 *   3. Bench Boost / save-BB advice around DGWs
 *   4. Wildcard when squad is underperforming over the horizon
 *
 * @param {Object[]} activePlayers
 * @param {Object[]} reservePlayers
 * @param {string[]} [usedChips]
 * @param {Object}   [options]
 * @param {Object}   [options.specialGws]   { [gw]: { dgwTeams, bgwTeams } }
 * @param {number}   [options.currentGW]
 * @param {Object}   [options.multiGwEpMap]
 * @returns {{ chip: string|null, saveFor: string|null, reason: string, recommendedGW: number|null }}
 */
function recommendChip(activePlayers, reservePlayers, usedChips = [], options = {}) {
  const { specialGws = {}, currentGW = null, multiGwEpMap = null } = options;
  const usedSet  = new Set(usedChips);
  const allSquad = [...activePlayers, ...reservePlayers];
  const nextDgw  = findNextDgw(specialGws, currentGW ?? 0);
  const thisgwInfo = currentGW ? (specialGws[currentGW] ?? {}) : {};
  const isCurrentDgw = (thisgwInfo.dgwTeams?.length ?? 0) >= 4;
  const isCurrentBgw = (thisgwInfo.bgwTeams?.length ?? 0) >= 8;

  // ── Free Hit on a significant Blank Gameweek ────────────────────────────────
  if (!usedSet.has('freehit') && isCurrentBgw) {
    return {
      chip: 'freehit',
      saveFor: null,
      reason: `GW${currentGW} has ${thisgwInfo.bgwTeams.length} teams without a fixture (Blank Gameweek) — Free Hit lets you field a full optimal XI this week.`,
      recommendedGW: currentGW,
    };
  }

  // ── Triple Captain ──────────────────────────────────────────────────────────
  if (!usedSet.has('3xc')) {
    const captainCandidates = [...activePlayers]
      .filter(p => p.element_type !== 1)
      .sort((a, b) => ep(b) - ep(a));
    const captain = captainCandidates[0];

    // Play TC now if this is a DGW and we have a doubling captain candidate
    if (isCurrentDgw) {
      const dgwCaptain = captainCandidates.find(p => thisgwInfo.dgwTeams.includes(p.team)) ?? captain;
      if (dgwCaptain) {
        return {
          chip: 'triple_captain',
          saveFor: null,
          reason: `GW${currentGW} is a Double Gameweek — ${dgwCaptain.web_name} plays twice and is predicted ${(ep(dgwCaptain) * 3).toFixed(0)} pts as Triple Captain.`,
          recommendedGW: currentGW,
        };
      }
    }

    // Save TC if a DGW is 1–2 GWs away
    if (nextDgw && nextDgw.gw <= (currentGW ?? 0) + 2) {
      return {
        chip: null,
        saveFor: 'triple_captain',
        reason: `Save Triple Captain for GW${nextDgw.gw} — a Double Gameweek is coming where ${nextDgw.dgwTeams.length} teams play twice.`,
        recommendedGW: nextDgw.gw,
      };
    }

    // No DGW in sight — use TC if captain has an exceptional matchup
    if (captain && ep(captain) >= 12) {
      return {
        chip: 'triple_captain',
        saveFor: null,
        reason: `${captain.web_name} has an exceptional predicted score of ${ep(captain).toFixed(1)} pts — Triple Captain could yield ${(ep(captain) * 3).toFixed(0)} pts.`,
        recommendedGW: currentGW,
      };
    }
  }

  // ── Bench Boost ─────────────────────────────────────────────────────────────
  if (!usedSet.has('bboost')) {
    const benchEp = reservePlayers.reduce((sum, p) => sum + ep(p), 0);

    if (isCurrentDgw && benchEp >= 15) {
      return {
        chip: 'bench_boost',
        saveFor: null,
        reason: `GW${currentGW} is a Double Gameweek and bench is predicted ${benchEp.toFixed(1)} pts combined — ideal for Bench Boost.`,
        recommendedGW: currentGW,
      };
    }
    if (benchEp >= 22) {
      return {
        chip: 'bench_boost',
        saveFor: null,
        reason: `Bench has a combined predicted score of ${benchEp.toFixed(1)} pts — Bench Boost should add significant returns.`,
        recommendedGW: currentGW,
      };
    }
    // Save advice if a DGW is 1–3 GWs away and bench is serviceable
    if (nextDgw && nextDgw.gw <= (currentGW ?? 0) + 3 && benchEp >= 14) {
      return {
        chip: null,
        saveFor: 'bench_boost',
        reason: `Consider saving Bench Boost for GW${nextDgw.gw} (Double Gameweek) to maximise bench returns.`,
        recommendedGW: nextDgw.gw,
      };
    }
  }

  // ── Wildcard ────────────────────────────────────────────────────────────────
  if (!usedSet.has('wildcard')) {
    const avgMg  = allSquad.reduce((s, p) => s + epMg(p, multiGwEpMap), 0) / Math.max(allSquad.length, 1);
    const threshold = PLANNING_HORIZON * 4.0; // avg < 4 pts/GW over horizon

    if (avgMg < threshold) {
      return {
        chip: 'wildcard',
        saveFor: null,
        reason: `Squad is underperforming — average ${(avgMg / PLANNING_HORIZON).toFixed(1)} pts/GW predicted over the next ${PLANNING_HORIZON} GWs. A Wildcard could allow a full squad overhaul.`,
        recommendedGW: currentGW,
      };
    }

    // Proactive Wildcard if a DGW is next GW and DGW coverage is poor
    if (nextDgw && nextDgw.gw === (currentGW ?? 0) + 1) {
      const dgwCoverage = allSquad.filter(p => nextDgw.dgwTeams.includes(p.team)).length;
      if (dgwCoverage < 8) {
        return {
          chip: null,
          saveFor: 'wildcard',
          reason: `Only ${dgwCoverage} squad players double in GW${nextDgw.gw}. Consider using Wildcard now to maximise Double Gameweek coverage.`,
          recommendedGW: currentGW,
        };
      }
    }
  }

  return { chip: null, saveFor: null, reason: 'No chip is recommended this gameweek.', recommendedGW: null };
}

// ── Season plan ───────────────────────────────────────────────────────────────

/**
 * Generate a high-level season plan covering chip scheduling and transfer
 * priorities over the full remaining season.
 *
 * @param {Object[]} squad
 * @param {Object[]} allPlayers
 * @param {number}   freeTransfers
 * @param {string[]} usedChips
 * @param {number}   currentGW
 * @param {Object}   specialGws     { [gw]: { dgwTeams, bgwTeams } }
 * @param {Object}   multiGwEpMap   { [playerId]: { total, hasDgw, gwEp } }
 * @returns {Object}
 */
function generateSeasonPlan(squad, allPlayers, freeTransfers, usedChips, currentGW, specialGws, multiGwEpMap) {
  const usedSet = new Set(usedChips);
  const remainingChips = ['wildcard', '3xc', 'bboost', 'freehit'].filter(c => !usedSet.has(c));

  // All upcoming DGWs and BGWs across the remaining season
  const allDgws = Object.entries(specialGws)
    .map(([gw, s]) => ({ gw: parseInt(gw), ...s }))
    .filter(s => s.gw > currentGW && s.dgwTeams.length >= 4)
    .sort((a, b) => a.gw - b.gw);

  const allBgws = Object.entries(specialGws)
    .map(([gw, s]) => ({ gw: parseInt(gw), ...s }))
    .filter(s => s.gw > currentGW && s.bgwTeams.length >= 8)
    .sort((a, b) => a.gw - b.gw);

  // ── Chip schedule ─────────────────────────────────────────────────────────
  const chipSchedule = [];

  if (remainingChips.includes('3xc')) {
    // TC on the biggest DGW (most teams doubling)
    const tcTarget = [...allDgws].sort((a, b) => b.dgwTeams.length - a.dgwTeams.length)[0];
    chipSchedule.push({
      chip: 'triple_captain',
      recommendedGW: tcTarget?.gw ?? null,
      reason: tcTarget
        ? `GW${tcTarget.gw} has ${tcTarget.dgwTeams.length} teams doubling — ideal for Triple Captain on a premium DGW asset.`
        : 'No Double Gameweek identified yet. Use Triple Captain when your captain has a standout fixture.',
    });
  }

  if (remainingChips.includes('bboost')) {
    // BB on a DGW — prefer the second one so you can build the bench via Wildcard first
    const bbTarget = allDgws.length > 1 ? allDgws[1] : allDgws[0];
    chipSchedule.push({
      chip: 'bench_boost',
      recommendedGW: bbTarget?.gw ?? null,
      reason: bbTarget
        ? `GW${bbTarget.gw} is a Double Gameweek — aim to have a strong bench by then for maximum Bench Boost value.`
        : 'Save Bench Boost for a Double Gameweek or a GW where your bench EP is unusually high.',
    });
  }

  if (remainingChips.includes('freehit')) {
    const fhTarget = allBgws[0];
    chipSchedule.push({
      chip: 'freehit',
      recommendedGW: fhTarget?.gw ?? null,
      reason: fhTarget
        ? `GW${fhTarget.gw} has ${fhTarget.bgwTeams.length} teams without a fixture — Free Hit lets you field a full temporary XI.`
        : 'No significant Blank Gameweek found yet. Save Free Hit for a GW with many blanks.',
    });
  }

  if (remainingChips.includes('wildcard')) {
    // Use Wildcard the GW before the biggest DGW to maximise coverage
    const wcDgwTarget = [...allDgws].sort((a, b) => b.dgwTeams.length - a.dgwTeams.length)[0];
    const wcGw = wcDgwTarget ? Math.max(currentGW + 1, wcDgwTarget.gw - 1) : null;
    chipSchedule.push({
      chip: 'wildcard',
      recommendedGW: wcGw,
      reason: wcGw
        ? `Use Wildcard in GW${wcGw} to build maximum Double Gameweek coverage ahead of GW${wcDgwTarget.gw}.`
        : 'Use Wildcard when squad form drops significantly or before a major fixture swing.',
    });
  }

  chipSchedule.sort((a, b) => {
    if (a.recommendedGW === null) return 1;
    if (b.recommendedGW === null) return -1;
    return a.recommendedGW - b.recommendedGW;
  });

  // ── Transfer priorities (weakest squad players by multi-GW EP) ────────────
  const squadIds = new Set(squad.map(p => p.id));
  const squadTeamCounts = {};
  squad.forEach(p => { squadTeamCounts[p.team] = (squadTeamCounts[p.team] || 0) + 1; });

  const weakPlayers = [...squad]
    .sort((a, b) => epMg(a, multiGwEpMap) - epMg(b, multiGwEpMap))
    .slice(0, 5);

  const transferTargets = [];
  for (const weak of weakPlayers) {
    const teamCountsWithout = { ...squadTeamCounts };
    teamCountsWithout[weak.team] = Math.max(0, (teamCountsWithout[weak.team] || 0) - 1);

    const target = allPlayers
      .filter(p =>
        !squadIds.has(p.id) &&
        p.element_type === weak.element_type &&
        (teamCountsWithout[p.team] || 0) < MAX_PLAYERS_PER_CLUB &&
        epMg(p, multiGwEpMap) > epMg(weak, multiGwEpMap)
      )
      .sort((a, b) => epMg(b, multiGwEpMap) - epMg(a, multiGwEpMap))[0];

    if (target) {
      const hasDgw = (multiGwEpMap?.[target.id]?.hasDgw?.length ?? 0) > 0;
      const epGainMg = epMg(target, multiGwEpMap) - epMg(weak, multiGwEpMap);
      transferTargets.push({
        playerOut: { id: weak.id, web_name: weak.web_name, element_type: weak.element_type, ep_mg: epMg(weak, multiGwEpMap) },
        playerIn:  { id: target.id, web_name: target.web_name, element_type: target.element_type, now_cost: target.now_cost, ep_mg: epMg(target, multiGwEpMap) },
        epGainMg,
        hasDgw,
        priority: hasDgw ? 'high' : 'normal',
      });
    }
  }

  transferTargets.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
    return b.epGainMg - a.epGainMg;
  });

  // Suggest holding a hit if best gain doesn't justify 4-pt cost
  const topGain = transferTargets[0]?.epGainMg ?? 0;
  const holdTransfers = freeTransfers < 1 && topGain < HIT_COST * 2;

  return {
    remainingGWs:    38 - currentGW,
    remainingChips,
    chipSchedule,
    transferTargets: transferTargets.slice(0, 5),
    holdTransfers,
    holdReason: holdTransfers
      ? `Best available transfer gains only ${topGain.toFixed(1)} pts over ${PLANNING_HORIZON} GWs — not worth the 4-pt hit.`
      : null,
    upcomingDgws: allDgws.slice(0, 3).map(d => ({ gw: d.gw, teamCount: d.dgwTeams.length })),
    upcomingBgws: allBgws.slice(0, 3).map(d => ({ gw: d.gw, teamCount: d.bgwTeams.length })),
  };
}

module.exports = {
  recommendCaptain,
  recommendLineup,
  recommendTransfers,
  recommendChip,
  generateSeasonPlan,
};
