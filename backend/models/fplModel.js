const axios = require('axios');

// Global toggles — can be overridden via env vars
// USE_COMPUTED_EP: 'true' | 'false' (prefer computed EP and optionally overwrite ep_next)
// INCLUDE_MANAGERS: 'true' | 'false' (enable manager placeholders in squads)
const USE_COMPUTED_EP = (process.env.USE_COMPUTED_EP ?? 'true') === 'true';
const INCLUDE_MANAGERS_GLOBAL = (process.env.INCLUDE_MANAGERS ?? 'false') === 'false';

/**
 * Compute head-to-head contribution from element-summary history.
 * Returns average goals+assists per matched historical game against the opponent.
 * If no element-summary / no matching fixtures found, returns 0.
 */
const computeHeadToHead = (player, upcomingOpponentId = null) => {
  const num = (v) => {
    if (v == null) return 0;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  const es = player.element_summary ?? player.elementSummary ?? null;
  // try to derive upcoming opponent id from common fields if not provided
  const opponentId = upcomingOpponentId ?? player.upcoming_opponent_team ?? player.opponent_team ?? player.next_opponent_team ?? null;

  if (!es || !Array.isArray(es.history) || opponentId == null) {
    return 0;
  }

  const matchesAgainst = es.history.filter(m => {
    // history entries sometimes use opponent_team or opponent; handle both
    return m.opponent_team === opponentId || m.opponent === opponentId;
  });

  if (matchesAgainst.length === 0) return 0;

  const totalGA = matchesAgainst.reduce((sum, m) => {
    return sum + num(m.goals_scored ?? m.goals) + num(m.assists);
  }, 0);

  return totalGA / matchesAgainst.length;
};

/**
 * Compute expected points from multiple factors:
 * xG, xA, clean sheets, defensive contributions, head2head.
 *
 * This is a simple weighted model that will fall back to the player's
 * ep_next value if the derived stats are not available.
 */
const computeExpectedPoints = (player) => {
  const num = (v) => {
    if (v == null) return 0;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  const xG = num(player.xG ?? player.xg ?? player.xG90 ?? player.xg90 ?? player.expected_goals);
  const xA = num(player.xA ?? player.xa ?? player.xA90 ?? player.xa90 ?? player.expected_assists);
  const cleanSheets = num(player.clean_sheets ?? player.cleanSheets ?? player.clean_sheet ?? 0);
  const defensiveContrib = num(player.defensive_contrib ?? player.def ?? player.def_contrib ?? 0);

  const computedH2H = computeHeadToHead(player);
  const head2head = computedH2H > 0 ? computedH2H : num(player.h2h ?? player.head2head ?? 0);

  const baseEp = num(player.ep_next ?? player.ep_next_raw ?? player.ep ?? 0);

  // Weights (reduced model influence so we don't push values below base)
  const W_XG = 3.0;
  const W_XA = 2.0;
  const W_CS = 2.0;
  const W_DEF = 1.0;
  const W_H2H = 0.8;

  let rawScore = xG * W_XG + xA * W_XA + cleanSheets * W_CS + defensiveContrib * W_DEF + head2head * W_H2H;

  // If no advanced stats, return base ep_next
  if (rawScore <= 0) return Number(baseEp.toFixed(2));

  // Blend settings: keep baseEp dominant, small model uplift
  const MODEL_WEIGHT = 0.35;
  const BASE_WEIGHT = 0.65;

  // Conservative normalization
  const featureSum = xG + xA + cleanSheets + defensiveContrib + head2head;
  const denom = Math.max(1, featureSum); // avoid tiny denom
  const normalizedScore = rawScore / denom;

  const MULTIPLIER = 1.2;
  let modelContribution = normalizedScore * MULTIPLIER * MODEL_WEIGHT;

  // Compose computed value
  let computed = baseEp * BASE_WEIGHT + modelContribution + baseEp * (1 - BASE_WEIGHT - MODEL_WEIGHT);
  // The extra term above ensures we don't unintentionally downscale baseEp when modelContribution is tiny.
  // (effectively computed >= baseEp unless modelContribution is negative, which it isn't here)

  // Enforce floor: never return less than baseEp
  computed = Math.max(computed, baseEp);

  // Cap uplift to avoid huge jumps
  const MAX_UPLIFT = 4;
  computed = Math.min(computed, baseEp + MAX_UPLIFT);

  return Number(Math.max(0, computed).toFixed(2));
};

// Helper to read ep value (prefers computed expected points)
// Uses boolean toggle USE_COMPUTED_EP to decide preference.
const getEpValue = (p) => {
  if (p == null) return 0;
  // always parse numeric helpers
  const asNumber = (v) => {
    if (v == null) return 0;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  // computed value (model output) and raw API ep_next
  const computed = p.computed_ep_next ?? p.computedEp ?? null;
  const raw = p.ep_next ?? p.ep_next_raw ?? p.ep ?? null;

  const preferComputed = !!USE_COMPUTED_EP;

  if (preferComputed) {
    if (computed != null) return asNumber(computed);
    if (raw != null) return asNumber(raw);
    return 0;
  }

  // prefer raw ep_next
  if (raw != null) return asNumber(raw);
  if (computed != null) return asNumber(computed);
  return 0;
};

const fetchBootstrapStatic = async () => {
  const response = await axios.get('https://fantasy.premierleague.com/api/bootstrap-static/');
  return response.data;
};

const fetchPlayerPicks = async (entryId, eventId) => {
  const response = await axios.get(`https://fantasy.premierleague.com/api/entry/${entryId}/event/${eventId}/picks/`);
  return response.data;
};

const fetchElementSummary = async (playerId) => {
  const response = await axios.get(`https://fantasy.premierleague.com/api/element-summary/${playerId}/`);
  return response.data;
};

const fetchFixtures = async () => {
  const response = await axios.get('https://fantasy.premierleague.com/api/fixtures/');
  return response.data;
};

/**
 * Enrich players with opponent data from fixtures.
 * Adds 'opponent' field (opponent team ID) and 'opponent_short' (short name) to each player.
 */
const enrichPlayersWithOpponents = (players, fixtures, teams, currentEventId) => {
  // Find next fixture for each team
  const nextFixtureByTeam = {};
  
  // Get upcoming fixtures (not finished, event >= current)
  const upcomingFixtures = fixtures.filter(f => !f.finished && f.event >= currentEventId);
  
  // Group by team and find earliest fixture for each team
  upcomingFixtures.forEach(fixture => {
    // Home team
    if (!nextFixtureByTeam[fixture.team_h] || fixture.event < nextFixtureByTeam[fixture.team_h].event) {
      nextFixtureByTeam[fixture.team_h] = {
        event: fixture.event,
        opponent: fixture.team_a,
        is_home: true
      };
    }
    // Away team
    if (!nextFixtureByTeam[fixture.team_a] || fixture.event < nextFixtureByTeam[fixture.team_a].event) {
      nextFixtureByTeam[fixture.team_a] = {
        event: fixture.event,
        opponent: fixture.team_h,
        is_home: false
      };
    }
  });
  
  // Create team lookup by id
  const teamMap = {};
  teams.forEach(team => {
    teamMap[team.id] = team;
  });
  
  // Enrich players
  return players.map(player => {
    const playerTeam = player.team;
    const nextFixture = nextFixtureByTeam[playerTeam];
    
    if (nextFixture && teamMap[nextFixture.opponent]) {
      const opponentTeam = teamMap[nextFixture.opponent];
      return {
        ...player,
        opponent: nextFixture.opponent,
        opponent_short: opponentTeam.short_name,
        is_home: nextFixture.is_home,
        next_event: nextFixture.event
      };
    }
    
    return {
      ...player,
      opponent: null,
      opponent_short: 'TBD',
      is_home: null,
      next_event: null
    };
  });
};

const buildTeam = (players, picks = null, { filterZeroEp = false, includeManagers = INCLUDE_MANAGERS_GLOBAL } = {}) => {
  // Ensure numeric ep_next helper
  const num = (v) => {
    if (v == null) return 0;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  // Build pool: either user's picks mapped to player objects, or all players
  let pool = [];
  if (Array.isArray(picks) && picks.length) {
    const playerMap = {};
    players.forEach((p) => { playerMap[p.id] = p; });
    pool = picks
      .map((pick) => {
        const player = playerMap[pick.element];
        if (!player) return null;
        return { ...player, ep_next: num(player.ep_next) };
      })
      .filter(Boolean);
  } else {
    pool = players.map(p => ({ ...p, ep_next: num(p.ep_next) }));
  }

  // Enrich with computed expected points
  // computeExpectedPoints must see the original ep_next/raw values, so compute first,
  // then optionally overwrite ep_next with computed value if USE_COMPUTED_EP === true.
  const enriched = pool.map(p => {
    const computed = computeExpectedPoints(p);
    const copy = { ...p, computed_ep_next: computed };
    if (USE_COMPUTED_EP) {
      // overwrite ep_next so subsequent sorting/selection uses the computed value
      copy.ep_next = computed;
    }
    return copy;
  });

  const byPos = (type) => enriched
    .filter((p) => p.element_type === type && (!filterZeroEp || getEpValue(p) > 0))
    .sort((a, b) => getEpValue(b) - getEpValue(a));

  const goalkeepers = byPos(1);
  const defenders = byPos(2);
  const midfielders = byPos(3);
  const forwards = byPos(4);
  const managers = includeManagers ? byPos(5) : [];

  const selectedGoalkeepers = goalkeepers.slice(0, 2);
  const selectedDefenders = defenders.slice(0, 5);
  const selectedMidfielders = midfielders.slice(0, 5);
  const selectedForwards = forwards.slice(0, 3);
  const selectedManagers = managers.slice(0, 2);

  let mainTeam = [
    ...(selectedManagers[0] ? [selectedManagers[0]] : []),
    selectedGoalkeepers[0],
    ...selectedDefenders.slice(0, 3),
    ...selectedMidfielders.slice(0, 3),
    selectedForwards[0],
  ];

  let remaining = [
    ...selectedDefenders.slice(3),
    ...selectedMidfielders.slice(3),
    ...selectedForwards.slice(1),
  ].sort((a, b) => getEpValue(b) - getEpValue(a));

  // target main team size: 11 player slots (or 12 if a manager placeholder is included)
  const targetMainSize = (includeManagers && selectedManagers[0]) ? 12 : 11;
  while (mainTeam.length < targetMainSize && remaining.length) {
    mainTeam.push(remaining.shift());
  }

  const gks = mainTeam.filter(p => p && p.element_type === 1).sort((a, b) => getEpValue(b) - getEpValue(a));
  const defs = mainTeam.filter(p => p && p.element_type === 2).sort((a, b) => getEpValue(b) - getEpValue(a));
  const mids = mainTeam.filter(p => p && p.element_type === 3).sort((a, b) => getEpValue(b) - getEpValue(a));
  const atts = mainTeam.filter(p => p && p.element_type === 4).sort((a, b) => getEpValue(b) - getEpValue(a));

  // Enforce valid FPL formation constraints:
  // 1 GK, defenders 3-5, midfielders 2-5, forwards 1-3; total outfield players = 10
  const MIN_DEF = 3, MAX_DEF = 5;
  const MIN_MID = 2, MAX_MID = 5;
  const MIN_ATT = 1, MAX_ATT = 3;
  const DESIRED_OUTFIELD = 10; // always 10 outfield players on the pitch

  // helpers working on the 'remaining' pool
  remaining = remaining || [];
  const pickFromRemaining = (type) => {
    const idx = remaining.findIndex(p => p.element_type === type);
    if (idx === -1) return null;
    return remaining.splice(idx, 1)[0];
  };
  const moveLowestToRemaining = (arr) => {
    if (!arr.length) return;
    let minIdx = 0;
    for (let i = 1; i < arr.length; i++) {
      if (getEpValue(arr[i]) < getEpValue(arr[minIdx])) minIdx = i;
    }
    const [pl] = arr.splice(minIdx, 1);
    remaining.push(pl);
    remaining.sort((a, b) => getEpValue(b) - getEpValue(a));
  };

  // Ensure exactly 1 goalkeeper in main team
  if (gks.length === 0) {
    const fromBenchGK = (selectedGoalkeepers[1] ? selectedGoalkeepers[1] : null) || pickFromRemaining(1);
    if (fromBenchGK) gks.push(fromBenchGK);
  }
  while (gks.length > 1) moveLowestToRemaining(gks);

  // Balance positions to satisfy minimums
  const balancePosition = (arr, type, min, max) => {
    // add until min satisfied
    while (arr.length < min) {
      const pick = pickFromRemaining(type);
      if (!pick) break;
      arr.push(pick);
      arr.sort((a, b) => getEpValue(b) - getEpValue(a));
    }
    // trim down to max
    while (arr.length > max) moveLowestToRemaining(arr);
  };

  balancePosition(defs, 2, MIN_DEF, MAX_DEF);
  balancePosition(mids, 3, MIN_MID, MAX_MID);
  balancePosition(atts, 4, MIN_ATT, MAX_ATT);

  // Ensure total outfield players equals DESIRED_OUTFIELD
  while ((defs.length + mids.length + atts.length) < DESIRED_OUTFIELD && remaining.length) {
    const candidate = remaining.shift();
    if (!candidate) break;
    if (candidate.element_type === 2 && defs.length < MAX_DEF) defs.push(candidate);
    else if (candidate.element_type === 3 && mids.length < MAX_MID) mids.push(candidate);
    else if (candidate.element_type === 4 && atts.length < MAX_ATT) atts.push(candidate);
    else {
      // place into any position below max
      if (defs.length < MAX_DEF) defs.push(candidate);
      else if (mids.length < MAX_MID) mids.push(candidate);
      else if (atts.length < MAX_ATT) atts.push(candidate);
      else {
        // nowhere to place; put back and stop
        remaining.unshift(candidate);
        break;
      }
    }
  }

  // If still too many outfield players, remove lowest from positions above minimums
  const totalOutfield = () => defs.length + mids.length + atts.length;
  while (totalOutfield() > DESIRED_OUTFIELD) {
    if (atts.length > MIN_ATT) moveLowestToRemaining(atts);
    else if (mids.length > MIN_MID) moveLowestToRemaining(mids);
    else if (defs.length > MIN_DEF) moveLowestToRemaining(defs);
    else break;
  }

  // Re-sort after adjustments
  defs.sort((a, b) => getEpValue(b) - getEpValue(a));
  mids.sort((a, b) => getEpValue(b) - getEpValue(a));
  atts.sort((a, b) => getEpValue(b) - getEpValue(a));

  mainTeam = [
    ...(selectedManagers[0] ? [selectedManagers[0]] : []),
    ...gks,
    ...defs,
    ...mids,
    ...atts,
  ].filter(Boolean);

  const benchGK = selectedGoalkeepers[1] ? [selectedGoalkeepers[1]] : [];
  const benchOutfield = remaining.sort((a, b) => getEpValue(b) - getEpValue(a));
  const benchManager = (includeManagers && selectedManagers[1]) ? [selectedManagers[1]] : [];

  const benchDefs = benchOutfield.filter(p => p.element_type === 2).sort((a, b) => getEpValue(b) - getEpValue(a));
  const benchMids = benchOutfield.filter(p => p.element_type === 3).sort((a, b) => getEpValue(b) - getEpValue(a));
  const benchAtts = benchOutfield.filter(p => p.element_type === 4).sort((a, b) => getEpValue(b) - getEpValue(a));

  const bench = [
    ...benchManager,
    ...benchGK,
    ...benchDefs,
    ...benchMids,
    ...benchAtts,
  ].filter(Boolean);

  return { mainTeam, bench };
};

const buildHighestPredictedTeam = (players) => {
  return buildTeam(players, null, { filterZeroEp: true });
};

const buildUserTeam = (players, picks) => {
  return buildTeam(players, picks);
};

/**
 * Validate if a swap between two players is allowed
 * @param {Object} player1 - First player
 * @param {Object} player2 - Second player
 * @param {string} teamType1 - 'main' or 'bench'
 * @param {string} teamType2 - 'main' or 'bench'
 * @param {Array} mainTeam - Current main team
 * @param {Array} benchTeam - Current bench team
 * @returns {Object} { valid: boolean, error: string }
 */
const validateSwap = (player1, player2, teamType1, teamType2, mainTeam, benchTeam) => {
  // Don't allow swaps within the same zone
  if (teamType1 === teamType2) {
    return {
      valid: false,
      error: 'Players can only be swapped between the starting squad and the bench.',
    };
  }

  const pos1 = player1.element_type || player1.position;
  const pos2 = player2.element_type || player2.position;

  // Only allow manager swaps if both are managers (position === 5)
  if (pos1 === 5 || pos2 === 5) {
    if (pos1 === 5 && pos2 === 5) {
      return { valid: true, error: '' };
    } else {
      return {
        valid: false,
        error: 'Managers can only be swapped with other managers.',
      };
    }
  }

  // Goalkeeper swap rule
  if (pos1 === 1 || pos2 === 1) {
    if (pos1 !== pos2) {
      return {
        valid: false,
        error: 'Goalkeepers can only be swapped with other goalkeepers.',
      };
    }
  }

  // Simulate the swap
  let newMain = [...mainTeam];
  let newBench = [...benchTeam];

  // Find indexes
  const idx1 = teamType1 === 'bench'
    ? newBench.findIndex(p => p.code === player1.code)
    : newMain.findIndex(p => p.code === player1.code);
  const idx2 = teamType2 === 'bench'
    ? newBench.findIndex(p => p.code === player2.code)
    : newMain.findIndex(p => p.code === player2.code);

  if (idx1 === -1 || idx2 === -1) {
    return { valid: false, error: 'Player not found in team.' };
  }

  // Perform the swap
  if (teamType1 === 'main' && teamType2 === 'bench') {
    [newMain[idx1], newBench[idx2]] = [newBench[idx2], newMain[idx1]];
  } else if (teamType1 === 'bench' && teamType2 === 'main') {
    [newBench[idx1], newMain[idx2]] = [newMain[idx2], newBench[idx1]];
  }

  // Count positions in new main team
  const positionCounts = newMain.reduce((counts, player) => {
    const pos = player.element_type || player.position;
    counts[pos] = (counts[pos] || 0) + 1;
    return counts;
  }, {});

  if ((positionCounts[2] || 0) < 3) {
    return {
      valid: false,
      error: 'The team must have at least 3 defenders.',
    };
  }
  if ((positionCounts[3] || 0) < 3) {
    return {
      valid: false,
      error: 'The team must have at least 3 midfielders.',
    };
  }
  if ((positionCounts[4] || 0) < 1) {
    return {
      valid: false,
      error: 'The team must have at least 1 forward.',
    };
  }

  return { valid: true, error: '' };
};

/**
 * Get available transfer targets for a specific player
 * @param {number} playerCode - Code of the player being transferred out
 * @param {Array} allPlayers - All enriched players
 * @param {Array} currentTeam - Current team (main + bench)
 * @returns {Array} Available players sorted by predicted points
 */
const getAvailableTransfers = (playerCode, allPlayers, currentTeam) => {
  const playerOut = currentTeam.find(p => p.code === playerCode);
  if (!playerOut) return [];

  const playerOutPosition = playerOut.element_type || playerOut.position;
  const teamCodes = new Set(currentTeam.map(p => p.code));

  return allPlayers
    .filter(p => {
      const pos = p.element_type || p.position;
      return pos === playerOutPosition && 
             !teamCodes.has(p.code) && 
             p.code !== playerCode;
    })
    .sort((a, b) => {
      const ptsA = parseFloat(a.ep_next) || 0;
      const ptsB = parseFloat(b.ep_next) || 0;
      return ptsB - ptsA;
    });
};

module.exports = {
  fetchBootstrapStatic,
  fetchPlayerPicks,
  fetchElementSummary,
  fetchFixtures,
  enrichPlayersWithOpponents,
  buildHighestPredictedTeam,
  buildUserTeam,
  validateSwap,
  getAvailableTransfers,
  // export toggles for external visibility if needed
  USE_COMPUTED_EP,
  INCLUDE_MANAGERS_GLOBAL,
};
