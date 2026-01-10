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
  // Validate entryId and eventId are positive integers
  if (!/^\d+$/.test(entryId) || !/^\d+$/.test(eventId)) {
    return res.status(400).json({ error: 'Invalid entryId or eventId' });
  }
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
  // Validate playerId is a positive integer
  if (!/^\d+$/.test(playerId)) {
    return res.status(400).json({ error: 'Invalid playerId' });
  }
  try {
    const data = await fplModel.fetchElementSummary(playerId);
    res.json(data);
  } catch (error) {
    console.error('Error fetching element summary:', error);
    res.status(500).json({ error: 'Error fetching element summary' });
  }
};

const getLiveGameweek = async (req, res) => {
  const { eventId } = req.params;
  // Validate eventId is a positive integer
  if (!/^\d+$/.test(eventId)) {
    return res.status(400).json({ error: 'Invalid eventId' });
  }
  try {
    const data = await fplModel.fetchLiveGameweek(eventId);
    res.json(data);
  } catch (error) {
    console.error('Error fetching live gameweek:', error);
    res.status(500).json({ error: 'Error fetching live gameweek' });
  }
};

const getPredictedTeam = async (req, res) => {
  try {
    const { gameweek } = req.query;
    const data = await fplModel.fetchBootstrapStatic();
    const fixtures = await fplModel.fetchFixtures();
    const currentEvent = data.events.find(e => e.is_current) || data.events[0];
    const targetEvent = gameweek ? parseInt(gameweek) : currentEvent.id;
    
    // Validate gameweek
    if (targetEvent < 1 || targetEvent > 38) {
      return res.status(400).json({ error: 'Gameweek must be between 1 and 38' });
    }
    
    const targetEventData = data.events.find(e => e.id === targetEvent);
    const isPastGameweek = targetEventData && targetEventData.finished;
    const isFutureGameweek = targetEvent > currentEvent.id;
    
    let players = data.elements.map((p) => ({
      ...p,
      ep_next: parseFloat(p.ep_next) || 0,
    }));
    
    // For past gameweeks, enrich with actual points from that gameweek
    if (isPastGameweek) {
      players = await fplModel.enrichPlayersWithGameweekStats(players, targetEvent);
    }
    
    // Enrich players with opponent data for target gameweek
    players = fplModel.enrichPlayersWithOpponents(players, fixtures, data.teams, targetEvent);
    
    // For future gameweeks, recalculate points based on specific opponents
    if (isFutureGameweek) {
      players = fplModel.recalculatePointsForGameweek(players, targetEvent, currentEvent.id);
    }
    
    // For past/present gameweeks, build team based on actual points from that gameweek
    // For future gameweeks, build team based on predictions for that specific gameweek
    const team = fplModel.buildHighestPredictedTeam(players, isPastGameweek, isFutureGameweek, targetEvent);
    
    res.json({
      ...team,
      gameweek: targetEvent,
      currentGameweek: currentEvent.id,
      isPastGameweek,
      isFutureGameweek,
      gameweekData: targetEventData
    });
  } catch (error) {
    console.error('Error building predicted team:', error);
    res.status(500).json({ error: 'Error building predicted team' });
  }
};

const getUserTeam = async (req, res) => {
  const { entryId, eventId } = req.params;
  const { gameweek } = req.query; // Optional gameweek parameter
  
  // Validate entryId and eventId are positive integers
  if (!/^\d+$/.test(entryId) || !/^\d+$/.test(eventId)) {
    return res.status(400).json({ error: 'Invalid entryId or eventId' });
  }
  
  try {
    const bootstrap = await fplModel.fetchBootstrapStatic();
    const targetEvent = gameweek ? parseInt(gameweek) : parseInt(eventId);
    
    // Validate gameweek is in valid range
    if (targetEvent < 1 || targetEvent > 38) {
      return res.status(400).json({ error: 'Gameweek must be between 1 and 38' });
    }
    
    const fixtures = await fplModel.fetchFixtures();
    const currentEvent = bootstrap.events.find(e => e.is_current) || bootstrap.events[0];
    const targetEventData = bootstrap.events.find(e => e.id === targetEvent);
    
    // For future gameweeks, use current picks since future picks don't exist yet
    const isFutureGameweek = targetEvent > currentEvent.id;
    const picksEventId = isFutureGameweek ? currentEvent.id : targetEvent;
    
    let picksData;
    try {
      picksData = await fplModel.fetchPlayerPicks(entryId, picksEventId);
    } catch (picksError) {
      console.error(`Error fetching picks for gameweek ${picksEventId}:`, picksError.message);
      return res.status(500).json({ error: 'Error fetching team picks' });
    }
    
    let players = bootstrap.elements.map((p) => ({
      ...p,
      ep_next: parseFloat(p.ep_next) || 0,
    }));
    
    // For past gameweeks, use actual points; for future, use predicted
    const isPastGameweek = targetEventData && targetEventData.finished;
    // Re-define isFutureGameweek here since it was used earlier
    const isFutureGameweekActual = targetEvent > currentEvent.id;
    
    // For past gameweeks, enrich with actual points from that gameweek
    if (isPastGameweek) {
      players = await fplModel.enrichPlayersWithGameweekStats(players, targetEvent);
    }
    
    // Enrich players with opponent data for the target gameweek
    players = fplModel.enrichPlayersWithOpponents(players, fixtures, bootstrap.teams, targetEvent);
    
    // For future gameweeks, recalculate points based on specific opponents
    if (isFutureGameweekActual) {
      players = fplModel.recalculatePointsForGameweek(players, targetEvent, currentEvent.id);
    }
    
    const { mainTeam, bench, captainInfo } = fplModel.buildUserTeam(players, picksData.picks, isPastGameweek);

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

    res.json({ 
      mainTeam, 
      bench, 
      teamName,
      gameweek: targetEvent,
      currentGameweek: currentEvent.id,
      isPastGameweek,
      isFutureGameweek: isFutureGameweekActual,
      gameweekData: targetEventData,
      captainInfo
    });
  } catch (error) {
    console.error('Error building user team:', error);
    res.status(500).json({ error: 'Error building user team' });
  }
};

const getUserProfile = async (req, res) => {
  const { entryId } = req.params;

  // Validate that entryId is a string of digits only (positive integer)
  if (!/^\d+$/.test(entryId)) {
    return res.status(400).json({ error: 'Invalid entryId format' });
  }

  try {
    const entryRes = await axios.get(`https://fantasy.premierleague.com/api/entry/${entryId}/`);
    const historyRes = await axios.get(`https://fantasy.premierleague.com/api/entry/${entryId}/history/`);

    const totalPoints = historyRes.data.current.reduce((sum, gw) => sum + gw.points, 0);
    const futureEvent = historyRes.data.future?.[0] || null;
    const futurePoints = futureEvent ? futureEvent.event : null;

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

const getAllPlayersEnriched = async (req, res) => {
  try {
    const data = await fplModel.fetchBootstrapStatic();
    const fixtures = await fplModel.fetchFixtures();
    const currentEvent = data.events.find(e => e.is_current) || data.events[0];
    
    let players = data.elements.map((p) => ({
      ...p,
      ep_next: parseFloat(p.ep_next) || 0,
    }));
    
    // Enrich players with opponent data
    players = fplModel.enrichPlayersWithOpponents(players, fixtures, data.teams, currentEvent.id);
    
    res.json({ elements: players, teams: data.teams, events: data.events });
  } catch (error) {
    console.error('Error fetching enriched players:', error);
    res.status(500).json({ error: 'Error fetching enriched players' });
  }
};

const validateSwap = async (req, res) => {
  try {
    const { player1, player2, teamType1, teamType2, mainTeam, benchTeam } = req.body;
    
    if (!player1 || !player2 || !teamType1 || !teamType2 || !mainTeam || !benchTeam) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const result = fplModel.validateSwap(player1, player2, teamType1, teamType2, mainTeam, benchTeam);
    res.json(result);
  } catch (error) {
    console.error('Error validating swap:', error);
    res.status(500).json({ error: 'Error validating swap' });
  }
};

const getAvailableTransfers = async (req, res) => {
  try {
    const { playerCode } = req.params;
    const { currentTeam } = req.body;
    
    if (!playerCode || !currentTeam) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Fetch enriched players
    const data = await fplModel.fetchBootstrapStatic();
    const fixtures = await fplModel.fetchFixtures();
    const currentEvent = data.events.find(e => e.is_current) || data.events[0];
    
    let players = data.elements.map((p) => ({
      ...p,
      ep_next: parseFloat(p.ep_next) || 0,
    }));
    
    players = fplModel.enrichPlayersWithOpponents(players, fixtures, data.teams, currentEvent.id);
    
    const availablePlayers = fplModel.getAvailableTransfers(parseInt(playerCode), players, currentTeam);
    res.json(availablePlayers);
  } catch (error) {
    console.error('Error fetching available transfers:', error);
    res.status(500).json({ error: 'Error fetching available transfers' });
  }
};

module.exports = {
  getBootstrapStatic,
  getPlayerPicks,
  getElementSummary,
  getLiveGameweek,
  getPredictedTeam,
  getUserTeam,
  getUserProfile,
  getAllPlayersEnriched,
  validateSwap,
  getAvailableTransfers
};
