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

// Team-building logic
const buildHighestPredictedTeam = (players) => {
  // Filter out players with 0 predicted points
  const goalkeepers = players.filter((p) => p.element_type === 1 && p.ep_next > 0).sort((a, b) => b.ep_next - a.ep_next);
  const defenders = players.filter((p) => p.element_type === 2 && p.ep_next > 0).sort((a, b) => b.ep_next - a.ep_next);
  const midfielders = players.filter((p) => p.element_type === 3 && p.ep_next > 0).sort((a, b) => b.ep_next - a.ep_next);
  const forwards = players.filter((p) => p.element_type === 4 && p.ep_next > 0).sort((a, b) => b.ep_next - a.ep_next);

  // Select top players for each position
  const squad = [
    ...goalkeepers.slice(0, 2), // 2 goalkeepers
    ...defenders.slice(0, 5),   // 5 defenders
    ...midfielders.slice(0, 5), // 5 midfielders
    ...forwards.slice(0, 3),    // 3 forwards
  ];

  // Sort squad by ep_next in descending order
  squad.sort((a, b) => b.ep_next - a.ep_next);

  // Pick starting 11: at least 1 GK, 3 DEF, 3 MID, 1 FWD
  const mainTeam = [];
  const bench = [];

  // Always 1 GK in main team, 1 on bench
  mainTeam.push(goalkeepers[0]);
  bench.push(goalkeepers[1]);

  // Add 3 best DEF, 3 best MID, 1 best FWD to main team
  mainTeam.push(...defenders.slice(0, 3));
  mainTeam.push(...midfielders.slice(0, 3));
  mainTeam.push(forwards[0]);

  // Fill remaining main team spots (to 11) with highest ep_next DEF/MID/FWD
  const remaining = [
    ...defenders.slice(3),
    ...midfielders.slice(3),
    ...forwards.slice(1),
  ].sort((a, b) => b.ep_next - a.ep_next);

  while (mainTeam.length < 11 && remaining.length) {
    mainTeam.push(remaining.shift());
  }

  // The rest go to the bench
  bench.push(...remaining);

  return { mainTeam, bench };
};

module.exports = {
  fetchBootstrapStatic,
  fetchPlayerPicks,
  fetchElementSummary,
  buildHighestPredictedTeam,
};
