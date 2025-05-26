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

  // Build main team and bench
  const mainTeam = [
    selectedGoalkeepers[0],           // 1 GK
    ...selectedDefenders.slice(0, 3), // 3 DEF
    ...selectedMidfielders.slice(0, 3), // 3 MID
    selectedForwards[0],              // 1 FWD
  ];

  // Fill up to 11 players in main team with highest ep_next from remaining DEF/MID/FWD
  const remaining = [
    ...selectedDefenders.slice(3),    // 2 DEF
    ...selectedMidfielders.slice(3),  // 2 MID
    ...selectedForwards.slice(1),     // 2 FWD
  ].sort((a, b) => b.ep_next - a.ep_next);

  while (mainTeam.length < 11 && remaining.length) {
    mainTeam.push(remaining.shift());
  }

  // Bench: 1 GK, rest of DEF/MID/FWD not in main team, and highest manager (only one)
  const bench = [
    selectedGoalkeepers[1], // 1 GK
    ...remaining,           // 4 players to make bench 5 total
    managers[0]             // 1 manager (highest ep_next)
  ].filter(Boolean);        // Remove undefined if not enough players

  return { mainTeam, bench };
};

module.exports = {
  fetchBootstrapStatic,
  fetchPlayerPicks,
  fetchElementSummary,
  buildHighestPredictedTeam,
};
