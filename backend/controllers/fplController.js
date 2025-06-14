const fplModel = require('../models/fplModel');
const axios = require('axios');

const getBootstrapStatic = async (req, res) => {
  try {
    const data = await fplModel.fetchBootstrapStatic();
    res.json(data);
  } catch (error) {
    console.error('Error fetching bootstrap-static:', error);
    res.status(500).json({ error: 'Error fetching bootstrap-static' });
  }
};

const getPlayerPicks = async (req, res) => {
  const { entryId, eventId } = req.params;
  try {
    const data = await fplModel.fetchPlayerPicks(entryId, eventId);
    res.json(data);
  } catch (error) {
    console.error('Error fetching player picks:', error);
    res.status(500).json({ error: 'Error fetching player picks' });
  }
};

const getElementSummary = async (req, res) => {
  const { playerId } = req.params;
  try {
    const data = await fplModel.fetchElementSummary(playerId);
    res.json(data);
  } catch (error) {
    console.error('Error fetching element summary:', error);
    res.status(500).json({ error: 'Error fetching element summary' });
  }
};

const getPredictedTeam = async (req, res) => {
  try {
    const data = await fplModel.fetchBootstrapStatic();
    const players = data.elements.map((p) => ({
      ...p,
      ep_next: parseFloat(p.ep_next) || 0,
    }));
    const team = fplModel.buildHighestPredictedTeam(players);
    res.json(team);
  } catch (error) {
    console.error('Error building predicted team:', error);
    res.status(500).json({ error: 'Error building predicted team' });
  }
};

const getUserTeam = async (req, res) => {
  const { entryId, eventId } = req.params;
  try {
    const bootstrap = await fplModel.fetchBootstrapStatic();
    const picksData = await fplModel.fetchPlayerPicks(entryId, eventId);
    const players = bootstrap.elements.map((p) => ({
      ...p,
      ep_next: parseFloat(p.ep_next) || 0,
    }));
    const { mainTeam, bench } = fplModel.buildUserTeam(players, picksData.picks);

    // Fetch the entry info for the team name
    let teamName = '';
    try {
      const entryRes = await axios.get(`https://fantasy.premierleague.com/api/entry/${entryId}/`);
      if (entryRes.data.player_first_name) {
        teamName = `${entryRes.data.player_first_name} ${entryRes.data.player_last_name}`;
      }
    } catch (e) {
      teamName = '';
    }

    res.json({ mainTeam, bench, teamName });
  } catch (error) {
    console.error('Error building user team:', error);
    res.status(500).json({ error: 'Error building user team' });
  }
};

// ...existing code...
const getUserProfile = async (req, res) => {
  const { entryId } = req.params;
  try {
    const entryRes = await axios.get(`https://fantasy.premierleague.com/api/entry/${entryId}/`);
    const historyRes = await axios.get(`https://fantasy.premierleague.com/api/entry/${entryId}/history/`);

    const totalPoints = historyRes.data.current.reduce((sum, gw) => sum + gw.points, 0);
    const futureEvent = historyRes.data.future?.[0] || null;
    const futurePoints = futureEvent ? futureEvent.event : null;

    // Extract classic leagues
    const classicLeagues = entryRes.data.leagues.classic.map(l => ({
      id: l.id,
      name: l.name,
      entry_rank: l.entry_rank,
      entry_last_rank: l.entry_last_rank,
      created: l.created,
      closed: l.closed,
      rank: l.rank,
      max_entries: l.max_entries,
      league_type: l.league_type,
      scoring: l.scoring,
      admin_entry: l.admin_entry,
      start_event: l.start_event,
      entry_can_admin: l.entry_can_admin,
      entry_can_leave: l.entry_can_leave,
      entry_can_invite: l.entry_can_invite,
      has_cup: l.has_cup,
      cup_league: l.cup_league,
      cup_qualified: l.cup_qualified,
    }));

    // Log league details
    console.log('Classic Leagues:', classicLeagues);

    res.json({
      entry: entryRes.data,
      totalPoints,
      futurePoints,
      classicLeagues,
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Error fetching user profile' });
  }
};
// ...existing code...

module.exports = {
  getBootstrapStatic,
  getPlayerPicks,
  getElementSummary,
  getPredictedTeam,
  getUserTeam,
  getUserProfile
};
