const axios = require('axios');

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
  // Filter and sort by predicted points
  const goalkeepers = players.filter((p) => p.element_type === 1 && p.ep_next > 0).sort((a, b) => b.ep_next - a.ep_next);
  const defenders = players.filter((p) => p.element_type === 2 && p.ep_next > 0).sort((a, b) => b.ep_next - a.ep_next);
  const midfielders = players.filter((p) => p.element_type === 3 && p.ep_next > 0).sort((a, b) => b.ep_next - a.ep_next);
  const forwards = players.filter((p) => p.element_type === 4 && p.ep_next > 0).sort((a, b) => b.ep_next - a.ep_next);
  const managers = players.filter((p) => p.element_type === 5 && p.ep_next > 0).sort((a, b) => b.ep_next - a.ep_next);

  // Select correct number for each position
  const selectedGoalkeepers = goalkeepers.slice(0, 2); // 1 main, 1 bench
  const selectedDefenders = defenders.slice(0, 5);     // 3 main, 2 bench
  const selectedMidfielders = midfielders.slice(0, 5); // 3 main, 2 bench
  const selectedForwards = forwards.slice(0, 3);       // 1 main, 2 bench
  const selectedManagers = managers.slice(0, 2);       // 1 main, 1 bench

  // Build main team (manager in first slot)
  let mainTeam = [
    selectedManagers[0],                // 1 Manager (main team, top right)
    selectedGoalkeepers[0],             // 1 GK
    ...selectedDefenders.slice(0, 3),   // 3 DEF
    ...selectedMidfielders.slice(0, 3), // 3 MID
    selectedForwards[0],                // 1 FWD
  ];

  // Fill up to 12 players in main team with highest ep_next from remaining DEF/MID/FWD
  let remaining = [
    ...selectedDefenders.slice(3),    // 2 DEF
    ...selectedMidfielders.slice(3),  // 2 MID
    ...selectedForwards.slice(1),     // 2 FWD
  ].sort((a, b) => b.ep_next - a.ep_next);

  while (mainTeam.length < 12 && remaining.length) {
    mainTeam.push(remaining.shift());
  }

  // Sort each position in mainTeam by points before returning (except manager stays first)
  const gks = mainTeam.filter(p => p && p.element_type === 1).sort((a, b) => b.ep_next - a.ep_next);
  const defs = mainTeam.filter(p => p && p.element_type === 2).sort((a, b) => b.ep_next - a.ep_next);
  const mids = mainTeam.filter(p => p && p.element_type === 3).sort((a, b) => b.ep_next - a.ep_next);
  const atts = mainTeam.filter(p => p && p.element_type === 4).sort((a, b) => b.ep_next - a.ep_next);

  mainTeam = [
    selectedManagers[0], // manager always first
    ...gks,
    ...defs,
    ...mids,
    ...atts,
  ].filter(Boolean);

  // Bench: 1 GK, rest of DEF/MID/FWD not in main team, and second highest manager
  const benchGK = selectedGoalkeepers[1] ? [selectedGoalkeepers[1]] : [];
  const benchOutfield = remaining.sort((a, b) => b.ep_next - a.ep_next);
  const benchManager = selectedManagers[1] ? [selectedManagers[1]] : [];

  // Sort each position in bench by points before returning
  const benchDefs = benchOutfield.filter(p => p.element_type === 2).sort((a, b) => b.ep_next - a.ep_next);
  const benchMids = benchOutfield.filter(p => p.element_type === 3).sort((a, b) => b.ep_next - a.ep_next);
  const benchAtts = benchOutfield.filter(p => p.element_type === 4).sort((a, b) => b.ep_next - a.ep_next);

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
  // Map pick.element to player object
  const playerMap = {};
  players.forEach((p) => { playerMap[p.id] = p; });

  // Only include players actually picked by the user
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

  // Filter and sort by predicted points
  const goalkeepers = pickedPlayers.filter((p) => p.element_type === 1 && p.ep_next > 0).sort((a, b) => b.ep_next - a.ep_next);
  const defenders = pickedPlayers.filter((p) => p.element_type === 2 && p.ep_next > 0).sort((a, b) => b.ep_next - a.ep_next);
  const midfielders = pickedPlayers.filter((p) => p.element_type === 3 && p.ep_next > 0).sort((a, b) => b.ep_next - a.ep_next);
  const forwards = pickedPlayers.filter((p) => p.element_type === 4 && p.ep_next > 0).sort((a, b) => b.ep_next - a.ep_next);
  const managers = pickedPlayers.filter((p) => p.element_type === 5 && p.ep_next > 0).sort((a, b) => b.ep_next - a.ep_next);

  // Select correct number for each position
  const selectedGoalkeepers = goalkeepers.slice(0, 2); // 1 main, 1 bench
  const selectedDefenders = defenders.slice(0, 5);     // 3 main, 2 bench
  const selectedMidfielders = midfielders.slice(0, 5); // 3 main, 2 bench
  const selectedForwards = forwards.slice(0, 3);       // 1 main, 2 bench
  const selectedManagers = managers.slice(0, 2);       // 1 main, 1 bench

  // Build main team (manager in first slot)
  let mainTeam = [
    selectedManagers[0],                // 1 Manager (main team, top right)
    selectedGoalkeepers[0],             // 1 GK
    ...selectedDefenders.slice(0, 3),   // 3 DEF
    ...selectedMidfielders.slice(0, 3), // 3 MID
    selectedForwards[0],                // 1 FWD
  ];

  // Fill up to 12 players in main team with highest ep_next from remaining DEF/MID/FWD
  let remaining = [
    ...selectedDefenders.slice(3),    // 2 DEF
    ...selectedMidfielders.slice(3),  // 2 MID
    ...selectedForwards.slice(1),     // 2 FWD
  ].sort((a, b) => b.ep_next - a.ep_next);

  while (mainTeam.length < 12 && remaining.length) {
    mainTeam.push(remaining.shift());
  }

  // Sort each position in mainTeam by points before returning (except manager stays first)
  const gks = mainTeam.filter(p => p && p.element_type === 1).sort((a, b) => b.ep_next - a.ep_next);
  const defs = mainTeam.filter(p => p && p.element_type === 2).sort((a, b) => b.ep_next - a.ep_next);
  const mids = mainTeam.filter(p => p && p.element_type === 3).sort((a, b) => b.ep_next - a.ep_next);
  const atts = mainTeam.filter(p => p && p.element_type === 4).sort((a, b) => b.ep_next - a.ep_next);

  mainTeam = [
    selectedManagers[0], // manager always first
    ...gks,
    ...defs,
    ...mids,
    ...atts,
  ].filter(Boolean);

  // Bench: 1 GK, rest of DEF/MID/FWD not in main team, and second highest manager
  const benchGK = selectedGoalkeepers[1] ? [selectedGoalkeepers[1]] : [];
  const benchOutfield = remaining.sort((a, b) => b.ep_next - a.ep_next);
  const benchManager = selectedManagers[1] ? [selectedManagers[1]] : [];

  // Sort each position in bench by points before returning
  const benchDefs = benchOutfield.filter(p => p.element_type === 2).sort((a, b) => b.ep_next - a.ep_next);
  const benchMids = benchOutfield.filter(p => p.element_type === 3).sort((a, b) => b.ep_next - a.ep_next);
  const benchAtts = benchOutfield.filter(p => p.element_type === 4).sort((a, b) => b.ep_next - a.ep_next);

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
