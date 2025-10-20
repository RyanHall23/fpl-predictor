const axios = require('axios');

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
  // try several common property names; falls back to 0
  const num = (v) => {
    if (v == null) return 0;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  const xG = num(player.xG ?? player.xg ?? player.xG90 ?? player.xg90 ?? player.expected_goals);
  const xA = num(player.xA ?? player.xa ?? player.xA90 ?? player.xa90 ?? player.expected_assists);
  const cleanSheets = num(player.clean_sheets ?? player.cleanSheets ?? player.clean_sheet ?? 0);
  const defensiveContrib = num(player.defensive_contrib ?? player.def ?? player.def_contrib ?? 0);

  // Prefer computed head2head from attached element-summary if available,
  // falling back to any existing h2h field on the player object.
  const computedH2H = computeHeadToHead(player);
  const head2head = computedH2H > 0
    ? computedH2H
    : num(player.h2h ?? player.head2head ?? 0);

  console.log(`Computing expected points for ${player.web_name || player.name || 'unknown'}: xG=${xG}, xA=${xA}, CS=${cleanSheets}, DEF=${defensiveContrib}, H2H=${head2head}`);

  // Weights (adjustable)
  const W_XG = 4.0;
  const W_XA = 3.0;
  const W_CS = 3.0;
  const W_DEF = 1.5;
  const W_H2H = 1.0;

  // Build a raw score
  let rawScore = xG * W_XG + xA * W_XA + cleanSheets * W_CS + defensiveContrib * W_DEF + head2head * W_H2H;

  // If rawScore is zero (no advanced stats), fall back to ep_next if present
  const baseEp = num(player.ep_next ?? player.ep_next_raw ?? player.ep ?? 0);

  if (rawScore <= 0) {
    return Number(baseEp.toFixed(2));
  }

  // Blend model score with base ep to keep values on typical FPL points scale.
  // You can tune the blend ratio as needed; current is 60% model, 40% base.
  const MODEL_WEIGHT = 0.6;
  const BASE_WEIGHT = 0.4;

  // Normalize rawScore roughly to expected points scale:
  // use a simple heuristic: scale by 1.0 / (max of xG/xA typical ranges)
  // (this is intentionally simple — replace with a trained scaler if available)
  const normalizedScore = rawScore / Math.max(1, xG + xA + cleanSheets + defensiveContrib + head2head);

  const computed = normalizedScore * 3.0 * MODEL_WEIGHT + baseEp * BASE_WEIGHT;
  return Number(Math.max(0, computed).toFixed(2));
};

// Helper to read ep value (prefers computed expected points)
const getEpValue = (p) => {
  if (p == null) return 0;
  const computed = p.computed_ep_next ?? p.computedEp ?? null;
  if (computed != null) return parseFloat(computed) || 0;
  return parseFloat(p.ep_next) || 0;
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

const buildHighestPredictedTeam = (players) => {
  // Enrich players with a computed expected points field (fallback safe)
  const enriched = players.map(p => ({ ...p, computed_ep_next: computeExpectedPoints(p) }));

  // Filter and sort by predicted points (use computed_ep_next where possible)
  const goalkeepers = enriched.filter((p) => p.element_type === 1 && getEpValue(p) > 0)
    .sort((a, b) => getEpValue(b) - getEpValue(a));
  const defenders = enriched.filter((p) => p.element_type === 2 && getEpValue(p) > 0)
    .sort((a, b) => getEpValue(b) - getEpValue(a));
  const midfielders = enriched.filter((p) => p.element_type === 3 && getEpValue(p) > 0)
    .sort((a, b) => getEpValue(b) - getEpValue(a));
  const forwards = enriched.filter((p) => p.element_type === 4 && getEpValue(p) > 0)
    .sort((a, b) => getEpValue(b) - getEpValue(a));
  const managers = enriched.filter((p) => p.element_type === 5 && getEpValue(p) > 0)
    .sort((a, b) => getEpValue(b) - getEpValue(a));

  // Select correct number for each position
  const selectedGoalkeepers = goalkeepers.slice(0, 2); // 1 main, 1 bench
  const selectedDefenders = defenders.slice(0, 5);     // 3 main, 2 bench
  const selectedMidfielders = midfielders.slice(0, 5); // 3 main, 2 bench
  const selectedForwards = forwards.slice(0, 3);       // 1 main, 2 bench
  const selectedManagers = managers.slice(0, 2);       // 1 main, 1 bench

  // Build main team (manager in first slot)
  let mainTeam = [
    selectedManagers[0],
    selectedGoalkeepers[0],
    ...selectedDefenders.slice(0, 3),
    ...selectedMidfielders.slice(0, 3),
    selectedForwards[0],
  ];

  // Fill up to 12 players in main team with highest ep_next from remaining DEF/MID/FWD
  let remaining = [
    ...selectedDefenders.slice(3),
    ...selectedMidfielders.slice(3),
    ...selectedForwards.slice(1),
  ].sort((a, b) => getEpValue(b) - getEpValue(a));

  while (mainTeam.length < 12 && remaining.length) {
    mainTeam.push(remaining.shift());
  }

  const gks = mainTeam.filter(p => p && p.element_type === 1).sort((a, b) => getEpValue(b) - getEpValue(a));
  const defs = mainTeam.filter(p => p && p.element_type === 2).sort((a, b) => getEpValue(b) - getEpValue(a));
  const mids = mainTeam.filter(p => p && p.element_type === 3).sort((a, b) => getEpValue(b) - getEpValue(a));
  const atts = mainTeam.filter(p => p && p.element_type === 4).sort((a, b) => getEpValue(b) - getEpValue(a));

  mainTeam = [
    selectedManagers[0],
    ...gks,
    ...defs,
    ...mids,
    ...atts,
  ].filter(Boolean);

  // Bench: 1 GK, rest of DEF/MID/FWD not in main team, and second highest manager
  const benchGK = selectedGoalkeepers[1] ? [selectedGoalkeepers[1]] : [];
  const benchOutfield = remaining.sort((a, b) => getEpValue(b) - getEpValue(a));
  const benchManager = selectedManagers[1] ? [selectedManagers[1]] : [];

  // Sort each position in bench by points before returning
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

/**
 * Format and strictly select/sort a user's team by highest predicted points per position,
 * regardless of pick order, just like buildHighestPredictedTeam.
 */
/**
 * Format and strictly select/sort a user's team by highest predicted points per position,
 * using the same logic as buildHighestPredictedTeam, but only from the user's actual picks.
 */
const buildUserTeam = (players, picks) => {
  const playerMap = {};
  players.forEach((p) => { playerMap[p.id] = p; });

  const pickedPlayers = picks
    .map((pick) => {
      const player = playerMap[pick.element];
      if (!player) return null;
      return {
        ...player,
        ep_next: parseFloat(player.ep_next) || 0,
      };
    })
    .filter(Boolean);

  // Enrich picked players with computed expected points
  const enriched = pickedPlayers.map(p => ({ ...p, computed_ep_next: computeExpectedPoints(p) }));

  const goalkeepers = enriched.filter((p) => p.element_type === 1).sort((a, b) => getEpValue(b) - getEpValue(a));
  const defenders = enriched.filter((p) => p.element_type === 2).sort((a, b) => getEpValue(b) - getEpValue(a));
  const midfielders = enriched.filter((p) => p.element_type === 3).sort((a, b) => getEpValue(b) - getEpValue(a));
  const forwards = enriched.filter((p) => p.element_type === 4).sort((a, b) => getEpValue(b) - getEpValue(a));
  const managers = enriched.filter((p) => p.element_type === 5).sort((a, b) => getEpValue(b) - getEpValue(a));

  const selectedGoalkeepers = goalkeepers.slice(0, 2);
  const selectedDefenders = defenders.slice(0, 5);
  const selectedMidfielders = midfielders.slice(0, 5);
  const selectedForwards = forwards.slice(0, 3);
  const selectedManagers = managers.slice(0, 2);

  let mainTeam = [
    selectedManagers[0],
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

  while (mainTeam.length < 12 && remaining.length) {
    mainTeam.push(remaining.shift());
  }

  const gks = mainTeam.filter(p => p && p.element_type === 1).sort((a, b) => getEpValue(b) - getEpValue(a));
  const defs = mainTeam.filter(p => p && p.element_type === 2).sort((a, b) => getEpValue(b) - getEpValue(a));
  const mids = mainTeam.filter(p => p && p.element_type === 3).sort((a, b) => getEpValue(b) - getEpValue(a));
  const atts = mainTeam.filter(p => p && p.element_type === 4).sort((a, b) => getEpValue(b) - getEpValue(a));

  mainTeam = [
    selectedManagers[0],
    ...gks,
    ...defs,
    ...mids,
    ...atts,
  ].filter(Boolean);

  // Bench: 1 GK, rest of DEF/MID/FWD not in main team, and second highest manager
  const benchGK = selectedGoalkeepers[1] ? [selectedGoalkeepers[1]] : [];
  const benchOutfield = remaining.sort((a, b) => getEpValue(b) - getEpValue(a));
  const benchManager = selectedManagers[1] ? [selectedManagers[1]] : [];

  // Sort each position in bench by points before returning
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

module.exports = {
  fetchBootstrapStatic,
  fetchPlayerPicks,
  fetchElementSummary,
  buildHighestPredictedTeam,
  buildUserTeam,
};
