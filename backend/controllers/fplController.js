const fplModel = require('../models/fplModel');
const dataProvider = require('../models/dataProvider');

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

    let targetEvent;
    if (gameweek !== undefined) {
      // Ensure gameweek is a numeric string
      if (!/^\d+$/.test(gameweek)) {
        return res.status(400).json({ error: 'Gameweek must be a valid number' });
      }
      targetEvent = parseInt(gameweek, 10);
    } else {
      targetEvent = currentEvent.id;
    }
    
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

    let targetEvent;
    if (typeof gameweek !== 'undefined') {
      // Validate gameweek is a numeric string
      if (!/^\d+$/.test(gameweek)) {
        return res.status(400).json({ error: 'Invalid gameweek' });
      }
      targetEvent = parseInt(gameweek, 10);
    } else {
      targetEvent = parseInt(eventId, 10);
    }
    
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
    
    // For past gameweeks, enrich with actual points from that gameweek
    if (isPastGameweek) {
      players = await fplModel.enrichPlayersWithGameweekStats(players, targetEvent);
    }
    
    // Enrich players with opponent data for the target gameweek
    players = fplModel.enrichPlayersWithOpponents(players, fixtures, bootstrap.teams, targetEvent);
    
    // For future gameweeks, recalculate points based on specific opponents
    if (isFutureGameweek) {
      players = fplModel.recalculatePointsForGameweek(players, targetEvent, currentEvent.id);
    }
    
    const { mainTeam, bench, captainInfo } = fplModel.buildUserTeam(players, picksData.picks, isPastGameweek);

    // Fetch the entry info for the team name
    let teamName = '';
    try {
      const entryData = await dataProvider.fetchEntry(entryId);
      if (entryData.player_first_name) {
        teamName = `${entryData.player_first_name} ${entryData.player_last_name}`;
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
      isFutureGameweek,
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
    const entryData = await dataProvider.fetchEntry(entryId);
    const historyData = await dataProvider.fetchHistory(entryId);

    const totalPoints = historyData.current.reduce((sum, gw) => sum + gw.points, 0);
    const futureEvent = historyData.future?.[0] || null;
    const futurePoints = futureEvent ? futureEvent.event : null;

    const classicLeagues = entryData.leagues.classic.map(l => ({
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
      entry: entryData,
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

// Configuration constants for recommendation algorithm
const MAX_WEAKEST_PLAYERS = 3;
const MAX_ALTERNATIVES = 5;
const MAX_GAMEWEEKS_AHEAD = 5;

/**
 * Generate recommended transfers for a user's team
 * 
 * @route GET /api/entry/:entryId/event/:eventId/recommended-transfers
 * @param {string} entryId - FPL entry/team ID
 * @param {string} eventId - Current gameweek ID
 * @param {string} gameweeksAhead - Number of gameweeks to forecast (0-5, default 1)
 * 
 * @returns {Object} recommendations - Transfer recommendations by position
 * @returns {Object} recommendations.GK - Goalkeeper recommendations
 * @returns {Object} recommendations.DEF - Defender recommendations
 * @returns {Object} recommendations.MID - Midfielder recommendations
 * @returns {Object} recommendations.ATT - Forward recommendations
 * @returns {number} targetGameweek - The gameweek being forecasted
 * @returns {number} currentGameweek - The current gameweek
 * @returns {number} gameweeksAhead - Number of gameweeks ahead forecasted
 * 
 * Algorithm:
 * 1. Fetches user's current team and all available players
 * 2. Enriches players with opponent data and recalculates points for target gameweek
 * 3. For each position, identifies the weakest players (up to 3)
 * 4. For each weak player, finds better alternatives (up to 5)
 * 5. Returns sorted recommendations showing player out vs alternatives
 */
const getRecommendedTransfers = async (req, res) => {
  const { entryId, eventId } = req.params;
  const { gameweeksAhead } = req.query;
  
  // Validate entryId and eventId are positive integers
  if (!/^\d+$/.test(entryId) || !/^\d+$/.test(eventId)) {
    return res.status(400).json({ error: 'Invalid entryId or eventId' });
  }
  
  // Validate gameweeksAhead (0-5, default 1)
  let lookahead = 1;
  if (gameweeksAhead !== undefined) {
    if (!/^\d+$/.test(gameweeksAhead)) {
      return res.status(400).json({ error: 'Invalid gameweeksAhead parameter' });
    }
    lookahead = parseInt(gameweeksAhead, 10);
    if (lookahead < 0 || lookahead > MAX_GAMEWEEKS_AHEAD) {
      return res.status(400).json({ error: `gameweeksAhead must be between 0 and ${MAX_GAMEWEEKS_AHEAD}` });
    }
  }
  
  try {
    const bootstrap = await fplModel.fetchBootstrapStatic();
    const fixtures = await fplModel.fetchFixtures();
    const currentEvent = bootstrap.events.find(e => e.is_current) || bootstrap.events[0];
    const startEvent = currentEvent.id + 1;
    const endEvent = currentEvent.id + lookahead;
    
    // Validate target gameweek
    if (endEvent < 1 || endEvent > 38) {
      return res.status(400).json({ error: 'Target gameweek out of range' });
    }
    
    // Get user's current team
    const picksData = await fplModel.fetchPlayerPicks(entryId, eventId);
    
    // Calculate cumulative predicted points across multiple gameweeks
    // For each player, sum predicted points from startEvent to endEvent
    let allPlayers = bootstrap.elements.map((p) => ({
      ...p,
      ep_next: parseFloat(p.ep_next) || 0,
    }));
    
    // Calculate cumulative points for each gameweek in the range
    const playerCumulativePoints = {};
    
    for (let gw = startEvent; gw <= endEvent; gw++) {
      if (gw > 38) break;
      
      let gwPlayers = allPlayers.map(p => ({ ...p }));
      gwPlayers = fplModel.enrichPlayersWithOpponents(gwPlayers, fixtures, bootstrap.teams, gw);
      
      if (gw > currentEvent.id) {
        gwPlayers = fplModel.recalculatePointsForGameweek(gwPlayers, gw, currentEvent.id);
      }
      
      gwPlayers.forEach(p => {
        if (!playerCumulativePoints[p.id]) {
          playerCumulativePoints[p.id] = {
            player: p,
            cumulativePoints: 0,
            gameweeks: []
          };
        }
        const points = parseFloat(p.ep_next) || 0;
        playerCumulativePoints[p.id].cumulativePoints += points;
        playerCumulativePoints[p.id].gameweeks.push({
          gameweek: gw,
          points: points,
          opponent: p.opponent_short || 'TBD',
          is_home: p.is_home
        });
      });
    }
    
    // Update allPlayers with cumulative points
    allPlayers = Object.values(playerCumulativePoints).map(data => ({
      ...data.player,
      ep_next: data.cumulativePoints,
      cumulative_points: data.cumulativePoints,
      gameweek_breakdown: data.gameweeks
    }));
    
    // Build user's team to get full player objects
    const userTeamIds = new Set(picksData.picks.map(p => p.element));
    const userPlayers = allPlayers.filter(p => userTeamIds.has(p.id));
    
    // Group user players by position
    const userByPosition = {
      1: userPlayers.filter(p => p.element_type === 1).sort((a, b) => parseFloat(b.ep_next) - parseFloat(a.ep_next)),
      2: userPlayers.filter(p => p.element_type === 2).sort((a, b) => parseFloat(b.ep_next) - parseFloat(a.ep_next)),
      3: userPlayers.filter(p => p.element_type === 3).sort((a, b) => parseFloat(b.ep_next) - parseFloat(a.ep_next)),
      4: userPlayers.filter(p => p.element_type === 4).sort((a, b) => parseFloat(b.ep_next) - parseFloat(a.ep_next)),
    };
    
    // Get available players by position (excluding user's team)
    const availableByPosition = {
      1: allPlayers.filter(p => p.element_type === 1 && !userTeamIds.has(p.id))
        .sort((a, b) => parseFloat(b.ep_next) - parseFloat(a.ep_next)),
      2: allPlayers.filter(p => p.element_type === 2 && !userTeamIds.has(p.id))
        .sort((a, b) => parseFloat(b.ep_next) - parseFloat(a.ep_next)),
      3: allPlayers.filter(p => p.element_type === 3 && !userTeamIds.has(p.id))
        .sort((a, b) => parseFloat(b.ep_next) - parseFloat(a.ep_next)),
      4: allPlayers.filter(p => p.element_type === 4 && !userTeamIds.has(p.id))
        .sort((a, b) => parseFloat(b.ep_next) - parseFloat(a.ep_next)),
    };
    
    // Generate recommendations: for each position, suggest transfers
    const recommendations = {};
    const positionNames = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'ATT' };
    
    Object.keys(userByPosition).forEach(posKey => {
      const pos = parseInt(posKey);
      const userPosPlayers = userByPosition[pos];
      const availablePosPlayers = availableByPosition[pos];
      
      if (!userPosPlayers.length || !availablePosPlayers.length) {
        recommendations[positionNames[pos]] = [];
        return;
      }
      
      // Find the weakest players in user's position
      const weakestPlayers = [...userPosPlayers]
        .sort((a, b) => parseFloat(a.ep_next) - parseFloat(b.ep_next))
        .slice(0, Math.min(MAX_WEAKEST_PLAYERS, userPosPlayers.length));
      
      const posRecommendations = [];
      const alreadyRecommended = new Set(); // Track recommended players to avoid duplicates
      
      weakestPlayers.forEach((weakPlayer, weakPlayerIndex) => {
        const weakPlayerPoints = parseFloat(weakPlayer.ep_next);
        const weakPlayerPrice = weakPlayer.now_cost / 10; // Convert to actual price
        
        // Get all better options excluding already recommended
        // ONLY recommend players with HIGHER predicted points
        let betterOptions = availablePosPlayers
          .filter(p => parseFloat(p.ep_next) > weakPlayerPoints && !alreadyRecommended.has(p.id));
        
        // If no better options exist, skip this player (don't recommend downgrades)
        if (betterOptions.length === 0) {
          return; // Skip to next weak player
        }
        
        // Diversify recommendations based on price ranges
        // Similar price: within ±0.5m
        // Budget: 0.5m+ cheaper
        // Premium: 0.5m+ expensive
        const similarPrice = betterOptions.filter(p => Math.abs((p.now_cost / 10) - weakPlayerPrice) <= 0.5);
        const budget = betterOptions.filter(p => (p.now_cost / 10) < weakPlayerPrice - 0.5);
        const premium = betterOptions.filter(p => (p.now_cost / 10) > weakPlayerPrice + 0.5);
        
        // For each weak player, distribute recommendations across price ranges
        // Take best from each category to ensure diversity
        const alternatives = [];
        const maxPerCategory = Math.ceil(MAX_ALTERNATIVES / 3);
        
        // Strategy: Alternate between price categories to provide diverse options
        if (weakPlayerIndex % 3 === 0) {
          // First weak player: focus on similar price + some premium
          alternatives.push(...similarPrice.slice(0, 2));
          alternatives.push(...premium.slice(0, 2));
          alternatives.push(...budget.slice(0, 1));
        } else if (weakPlayerIndex % 3 === 1) {
          // Second weak player: focus on premium + some similar
          alternatives.push(...premium.slice(0, 2));
          alternatives.push(...similarPrice.slice(2, 4));
          alternatives.push(...budget.slice(0, 1));
        } else {
          // Third weak player: focus on budget + mixed
          alternatives.push(...budget.slice(0, 2));
          alternatives.push(...similarPrice.slice(4, 6));
          alternatives.push(...premium.slice(2, 3));
        }
        
        // Remove duplicates and take top MAX_ALTERNATIVES
        const uniqueAlternatives = [...new Map(alternatives.map(p => [p.id, p])).values()]
          .slice(0, MAX_ALTERNATIVES);
        
        // If still not enough, fill with next best options
        if (uniqueAlternatives.length < MAX_ALTERNATIVES) {
          const remainingOptions = betterOptions
            .filter(p => !uniqueAlternatives.find(alt => alt.id === p.id))
            .slice(0, MAX_ALTERNATIVES - uniqueAlternatives.length);
          uniqueAlternatives.push(...remainingOptions);
        }
        
        // Mark these alternatives as recommended
        uniqueAlternatives.forEach(alt => alreadyRecommended.add(alt.id));
        
        if (uniqueAlternatives.length > 0) {
          posRecommendations.push({
            playerOut: {
              id: weakPlayer.id,
              code: weakPlayer.code,
              name: `${weakPlayer.first_name} ${weakPlayer.second_name}`,
              web_name: weakPlayer.web_name,
              team: weakPlayer.team,
              predicted_points: weakPlayerPoints,
              opponent: weakPlayer.opponent_short || 'TBD',
              is_home: weakPlayer.is_home,
              now_cost: weakPlayer.now_cost,
              total_points: weakPlayer.total_points
            },
            alternatives: uniqueAlternatives.map(alt => ({
              id: alt.id,
              code: alt.code,
              name: `${alt.first_name} ${alt.second_name}`,
              web_name: alt.web_name,
              team: alt.team,
              predicted_points: parseFloat(alt.ep_next),
              opponent: alt.opponent_short || 'TBD',
              is_home: alt.is_home,
              now_cost: alt.now_cost,
              total_points: alt.total_points,
              points_difference: parseFloat(alt.ep_next) - weakPlayerPoints
            }))
          });
        }
      });
      
      recommendations[positionNames[pos]] = posRecommendations;
    });
    
    res.json({
      recommendations,
      startGameweek: startEvent,
      endGameweek: endEvent,
      currentGameweek: currentEvent.id,
      gameweeksAhead: lookahead
    });
  } catch (error) {
    console.error('Error generating recommended transfers:', error.message);
    res.status(500).json({ error: 'Error generating recommended transfers' });
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
  getAvailableTransfers,
  getRecommendedTransfers
};
