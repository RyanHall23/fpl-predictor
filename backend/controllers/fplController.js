const fplModel = require('../models/fplModel');
const dataProvider = require('../models/dataProvider');


/**
 * Calculate purchase prices for current squad by analyzing FPL picks history
 * Handles in/out/in scenarios by finding when each player was most recently added
 * @param {number} entryId - FPL entry/team ID
 * @param {Array<number>} currentPlayerIds - Array of player IDs currently in the squad
 * @param {number} currentGameweek - Current gameweek number
 * @returns {Promise<Object>} - Map of playerId to {purchasePrice, currentPrice, gameweekAdded}
 */
async function calculatePurchasePricesFromPicks(entryId, currentPlayerIds, currentGameweek) {
  const purchasePriceMap = {};
  
  try {
    console.log(`[calculatePurchasePricesFromPicks] Starting for entry ${entryId}, GW1-${currentGameweek}, ${currentPlayerIds.length} players`);
    
    // Fetch picks for all gameweeks in parallel with batching to avoid overwhelming API
    const batchSize = 10; // Process 10 gameweeks at a time
    const picksHistory = {};
    
    for (let startGW = 1; startGW <= currentGameweek; startGW += batchSize) {
      const endGW = Math.min(startGW + batchSize - 1, currentGameweek);
      const gwRange = [];
      
      for (let gw = startGW; gw <= endGW; gw++) {
        gwRange.push(gw);
      }
      
      // Fetch this batch in parallel
      const batchResults = await Promise.allSettled(
        gwRange.map(gw => dataProvider.fetchPlayerPicks(entryId, gw))
      );
      
      // Process results
      gwRange.forEach((gw, index) => {
        const result = batchResults[index];
        if (result.status === 'fulfilled' && result.value && result.value.picks) {
          picksHistory[gw] = result.value.picks.map(p => p.element);
        } else if (result.status === 'rejected') {
          console.warn(`Could not fetch picks for GW${gw}:`, result.reason?.message || 'Unknown error');
        }
      });
      
      // Small delay between batches to be respectful to API
      if (dataProvider.USE_FPL_API && endGW < currentGameweek) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    console.log(`[calculatePurchasePricesFromPicks] Fetched picks for ${Object.keys(picksHistory).length} gameweeks`);
    
    if (Object.keys(picksHistory).length === 0) {
      console.warn('[calculatePurchasePricesFromPicks] No picks history fetched - cannot calculate purchase prices');
      return {};
    }
    
    // For each current player, find when they were most recently added
    for (const playerId of currentPlayerIds) {
      try {
        let gameweekAdded = null;
        let wasInPreviousGW = false;
        
        // Walk through gameweeks chronologically
        for (let gw = 1; gw <= currentGameweek; gw++) {
          if (!picksHistory[gw]) continue;
          
          const isInCurrentGW = picksHistory[gw].includes(playerId);
          
          if (isInCurrentGW && !wasInPreviousGW) {
            // Player was added in this gameweek (either first time or re-added)
            gameweekAdded = gw;
          }
          
          wasInPreviousGW = isInCurrentGW;
        }
        
        // Store gameweek for batch fetching
        if (gameweekAdded) {
          purchasePriceMap[playerId] = { gameweekAdded };
        } else {
          console.warn(`Player ${playerId}: Could not determine when they were added`);
        }
      } catch (playerError) {
        console.warn(`Error processing player ${playerId}:`, playerError.message);
      }
    }
    
    // Now fetch element summaries in parallel for all players
    const playerIdsToFetch = Object.keys(purchasePriceMap).map(id => parseInt(id));
    
    console.log(`[calculatePurchasePricesFromPicks] Found gameweek added for ${playerIdsToFetch.length}/${currentPlayerIds.length} players`);
    
    if (playerIdsToFetch.length > 0) {
      console.log(`[calculatePurchasePricesFromPicks] Fetching element summaries for ${playerIdsToFetch.length} players`);
      
      const elementResults = await Promise.allSettled(
        playerIdsToFetch.map(playerId => dataProvider.fetchElementSummary(playerId))
      );
      
      // Process element summary results
      playerIdsToFetch.forEach((playerId, index) => {
        const result = elementResults[index];
        const gameweekAdded = purchasePriceMap[playerId].gameweekAdded;
        
        if (result.status === 'fulfilled' && result.value && result.value.history) {
          const elementSummary = result.value;
          
          // Find the price at the START of the gameweek they were added
          // The history entry shows the price at the END of each gameweek
          // So we need to use the price from the PREVIOUS gameweek (or start price for GW1)
          let purchasePrice = null;
          
          if (gameweekAdded === 1) {
            // For GW1, check if there's a history entry, otherwise use bootstrap start price
            const gw1Entry = elementSummary.history.find(h => h.round === 1);
            if (gw1Entry) {
              purchasePrice = gw1Entry.value;
            }
          } else {
            // For other gameweeks, use the price from the PREVIOUS gameweek
            // This is the price at the time of transfer
            const previousGwEntry = elementSummary.history.find(h => h.round === gameweekAdded - 1);
            if (previousGwEntry) {
              purchasePrice = previousGwEntry.value;
            } else {
              // Fallback: if previous GW not found, use the entry for the added GW
              const historyEntry = elementSummary.history.find(h => h.round === gameweekAdded);
              if (historyEntry) {
                purchasePrice = historyEntry.value;
              }
            }
          }
          
          if (purchasePrice !== null) {
            // Get current price from latest history entry
            const latestHistory = elementSummary.history[elementSummary.history.length - 1];
            const currentPrice = latestHistory ? latestHistory.value : purchasePrice;
            
            purchasePriceMap[playerId] = {
              purchasePrice,
              currentPrice,
              gameweekAdded
            };
            
            console.log(`[calculatePurchasePricesFromPicks] Player ${playerId}: Added in GW${gameweekAdded}, Purchase: £${purchasePrice / 10}m, Current: £${currentPrice / 10}m`);
          } else {
            console.warn(`[calculatePurchasePricesFromPicks] Player ${playerId}: No history entry found for GW${gameweekAdded} or previous GW`);
            delete purchasePriceMap[playerId];
          }
        } else if (result.status === 'rejected') {
          console.warn(`[calculatePurchasePricesFromPicks] Player ${playerId}: Could not fetch element summary:`, result.reason?.message || 'Unknown error');
          delete purchasePriceMap[playerId];
        }
      });
    }
    
    console.log(`[calculatePurchasePricesFromPicks] Successfully calculated prices for ${Object.keys(purchasePriceMap).length} players`);
    return purchasePriceMap;
  } catch (error) {
    console.error('Error calculating purchase prices from picks:', error);
    return {};
  }
}


const getBootstrapStatic = async (req, res) => {
  try {
    const data = await fplModel.fetchBootstrapStatic();
    res.json(data);
  } catch (error) {
    console.error('Error fetching bootstrap-static:', error);
    res.status(500).json({ error: 'Error fetching bootstrap-static' });
  }
};

const getFixtures = async (req, res) => {
  try {
    const { gameweek } = req.query;
    const [fixtures, bootstrap] = await Promise.all([
      fplModel.fetchFixtures(),
      fplModel.fetchBootstrapStatic(),
    ]);

    const teamsById = {};
    bootstrap.teams.forEach(t => { teamsById[t.id] = t; });

    let filtered = fixtures;
    if (gameweek !== undefined) {
      if (!/^\d+$/.test(gameweek)) {
        return res.status(400).json({ error: 'Gameweek must be a valid number' });
      }
      const gw = parseInt(gameweek, 10);
      filtered = fixtures.filter(f => f.event === gw);
    }

    const result = filtered.map(f => ({
      id: f.id,
      event: f.event,
      kickoff_time: f.kickoff_time,
      started: f.started,
      finished: f.finished,
      team_h: f.team_h,
      team_a: f.team_a,
      team_h_score: f.team_h_score,
      team_a_score: f.team_a_score,
      team_h_name: teamsById[f.team_h]?.name || '',
      team_a_name: teamsById[f.team_a]?.name || '',
      team_h_short: teamsById[f.team_h]?.short_name || '',
      team_a_short: teamsById[f.team_a]?.short_name || '',
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching fixtures:', error);
    res.status(500).json({ error: 'Error fetching fixtures' });
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
    
    // Enrich players with opponent display data (opponent name, home/away, DGW support)
    players = fplModel.enrichPlayersWithOpponents(players, fixtures, data.teams, targetEvent);
    
    // For non-past gameweeks, apply the advanced prediction engine which uses
    // ELO team strength, Poisson distributions, Monte Carlo simulation, and the
    // full FPL scoring rules to compute statistically grounded predictions.
    if (!isPastGameweek) {
      players = fplModel.applyAdvancedPredictions(players, fixtures, data.teams, targetEvent);
    }
    
    // Build team based on actual points (past) or predictions (current/future)
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
    
    // Enrich players with opponent display data for the target gameweek
    players = fplModel.enrichPlayersWithOpponents(players, fixtures, bootstrap.teams, targetEvent);
    
    // For non-past gameweeks, apply the advanced prediction engine
    if (!isPastGameweek) {
      players = fplModel.applyAdvancedPredictions(players, fixtures, bootstrap.teams, targetEvent);
    }
    
    const { mainTeam, bench, captainInfo } = fplModel.buildUserTeam(players, picksData.picks, isPastGameweek);

    // Fetch the entry info for the team name
    let teamName = '';
    try {
      const entryData = await dataProvider.fetchEntry(entryId);
      if (entryData.player_first_name) {
        teamName = `${entryData.player_first_name} ${entryData.player_last_name}`;
      }
    } catch {
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

    // Optional ?gameweek= param so the transfer dropdown can request predictions
    // for the specific gameweek the user is currently viewing.  Without it,
    // default to the next upcoming event (transfers are always for next GW).
    let targetEvent;
    if (req.query.gameweek !== undefined) {
      if (!/^\d{1,2}$/.test(req.query.gameweek)) {
        return res.status(400).json({ error: 'Invalid gameweek' });
      }
      targetEvent = parseInt(req.query.gameweek, 10);
      if (targetEvent < 1 || targetEvent > 38) {
        return res.status(400).json({ error: 'Gameweek must be between 1 and 38' });
      }
    } else {
      // Default: next upcoming event; fall back to current if no next
      const nextEvent = data.events.find(e => e.is_next);
      targetEvent = nextEvent ? nextEvent.id : currentEvent.id;
    }

    let players = data.elements.map((p) => ({
      ...p,
      ep_next: parseFloat(p.ep_next) || 0,
    }));
    
    // Enrich players with opponent display data for the target gameweek
    players = fplModel.enrichPlayersWithOpponents(players, fixtures, data.teams, targetEvent);
    
    // Apply the advanced prediction engine for the target gameweek so that
    // blank-GW teams correctly receive 0 predicted points in the transfer UI.
    players = fplModel.applyAdvancedPredictions(players, fixtures, data.teams, targetEvent);
    
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
    
    let purchasePriceMap = {};
    const currentPlayerIds = picksData.picks.map(p => p.element);
    
    // Calculate purchase prices from FPL picks history
    try {
      purchasePriceMap = await calculatePurchasePricesFromPicks(entryId, currentPlayerIds, currentEvent.id);
    } catch (picksError) {
      console.warn('[getRecommendedTransfers] Could not calculate purchase prices from FPL picks:', picksError.message);
    }
    
    // Fallback: use current price for any players without calculated prices
    if (Object.keys(purchasePriceMap).length === 0) {
      currentPlayerIds.forEach(playerId => {
        const playerData = bootstrap.elements.find(p => p.id === playerId);
        if (playerData) {
          purchasePriceMap[playerId] = {
            purchasePrice: playerData.now_cost,
            currentPrice: playerData.now_cost,
            gameweekAdded: null
          };
        }
      });
    }
    
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
      gwPlayers = fplModel.applyAdvancedPredictions(gwPlayers, fixtures, bootstrap.teams, gw);
      
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
          opponent: p.opponent_short || '-',
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
          // Calculate selling price for playerOut
          const purchaseInfo = purchasePriceMap[weakPlayer.id];
          let purchasePrice = null;
          let sellingPrice = null;

          if (purchaseInfo) {
            purchasePrice = purchaseInfo.purchasePrice;
            const currentPrice = weakPlayer.now_cost;

            // Calculate selling price using FPL rules:
            // - If price dropped: selling price = current price (you lose the full amount)
            // - If price increased: selling price = purchase price + floor(profit / 2)
            if (currentPrice <= purchasePrice) {
              sellingPrice = currentPrice;
            } else {
              const profit = currentPrice - purchasePrice;
              const profitToKeep = Math.floor(profit / 2);
              sellingPrice = purchasePrice + profitToKeep;
            }

            // Add console logging for price info
            // Price info logging removed - can be enabled for debugging
            // console.log(`Player: ${weakPlayer.first_name} ${weakPlayer.second_name} (ID: ${weakPlayer.id})`);
            // console.log(`  Purchase Price: ${purchasePrice}`);
            // console.log(`  Current Price: ${currentPrice}`);
            // console.log(`  Selling Price: ${sellingPrice}`);
          } else {
            // Purchase info not found - player uses current price as both purchase and selling price
            purchasePrice = weakPlayer.now_cost;
            sellingPrice = weakPlayer.now_cost;
            console.warn(`Player ${weakPlayer.id}: Using current price (${weakPlayer.now_cost}) as fallback for purchase/selling price`);
          }

          posRecommendations.push({
            playerOut: {
              id: weakPlayer.id,
              code: weakPlayer.code,
              name: `${weakPlayer.first_name} ${weakPlayer.second_name}`,
              web_name: weakPlayer.web_name,
              team: weakPlayer.team,
              predicted_points: weakPlayerPoints,
              opponent: weakPlayer.opponent_short || '-',
              is_home: weakPlayer.is_home,
              now_cost: weakPlayer.now_cost,
              purchase_price: purchasePrice,
              selling_price: sellingPrice,
              total_points: weakPlayer.total_points
            },
            alternatives: uniqueAlternatives.map(alt => ({
              id: alt.id,
              code: alt.code,
              name: `${alt.first_name} ${alt.second_name}`,
              web_name: alt.web_name,
              team: alt.team,
              predicted_points: parseFloat(alt.ep_next),
              opponent: alt.opponent_short || '-',
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

/**
 * Calculate cumulative predicted points for a set of player IDs across one or more gameweeks.
 * @param {Array} allPlayers - Enriched player list
 * @param {Array} fixtures - Fixture list
 * @param {Array} teams - Team list
 * @param {number} currentEventId - Current gameweek ID
 * @param {number} gameweeksAhead - Number of gameweeks ahead to sum (1-5)
 * @returns {Object} Map of playerId -> cumulative predicted points
 */
function buildPlayerPointsMap(allPlayers, fixtures, teams, currentEventId, gameweeksAhead) {
  const startEvent = currentEventId + 1;
  const endEvent = currentEventId + gameweeksAhead;
  const playerPointsMap = {};

  for (let gw = startEvent; gw <= Math.min(endEvent, 38); gw++) {
    let gwPlayers = allPlayers.map(p => ({ ...p }));
    gwPlayers = fplModel.enrichPlayersWithOpponents(gwPlayers, fixtures, teams, gw);
    gwPlayers = fplModel.applyAdvancedPredictions(gwPlayers, fixtures, teams, gw);
    gwPlayers.forEach(p => {
      playerPointsMap[p.id] = (playerPointsMap[p.id] || 0) + (parseFloat(p.ep_next) || 0);
    });
  }

  return playerPointsMap;
}

/**
 * Get classic league standings with predicted points for each team.
 *
 * @route GET /api/leagues-classic/:leagueId/standings
 * @param {string} leagueId - FPL classic league ID
 * @param {string} [gameweeksAhead=1] - Number of gameweeks to forecast (1-5)
 *
 * @returns {Object} league - League metadata
 * @returns {Array} standings - Standings with predicted_points added to each entry
 * @returns {number} currentGameweek - Current gameweek number
 * @returns {number} gameweeksAhead - Number of gameweeks forecast
 */
const getLeagueStandings = async (req, res) => {
  const { leagueId } = req.params;

  if (!/^\d+$/.test(leagueId)) {
    return res.status(400).json({ error: 'Invalid leagueId format' });
  }

  let gameweeksAhead = 1;
  if (req.query.gameweeksAhead !== undefined) {
    if (!/^\d+$/.test(req.query.gameweeksAhead)) {
      return res.status(400).json({ error: 'Invalid gameweeksAhead parameter' });
    }
    gameweeksAhead = parseInt(req.query.gameweeksAhead, 10);
    if (gameweeksAhead < 1 || gameweeksAhead > MAX_GAMEWEEKS_AHEAD) {
      return res.status(400).json({ error: `gameweeksAhead must be between 1 and ${MAX_GAMEWEEKS_AHEAD}` });
    }
  }

  try {
    const [standingsData, bootstrap, fixtures] = await Promise.all([
      dataProvider.fetchLeagueStandings(leagueId),
      fplModel.fetchBootstrapStatic(),
      fplModel.fetchFixtures(),
    ]);

    const currentEvent = bootstrap.events.find(e => e.is_current) || bootstrap.events[0];

    // Build base player list enriched with predicted points
    let allPlayers = bootstrap.elements.map(p => ({
      ...p,
      ep_next: parseFloat(p.ep_next) || 0,
    }));

    // Pre-compute per-player cumulative predicted points map
    const playerPointsMap = buildPlayerPointsMap(
      allPlayers, fixtures, bootstrap.teams, currentEvent.id, gameweeksAhead
    );

    const entries = standingsData.standings?.results || [];

    // Fetch picks for all entries in parallel
    const picksResults = await Promise.allSettled(
      entries.map(entry => fplModel.fetchPlayerPicks(entry.entry, currentEvent.id))
    );

    const standingsWithPredictions = entries.map((entry, i) => {
      let predictedPoints = null;
      const picksResult = picksResults[i];
      if (picksResult.status === 'fulfilled' && picksResult.value?.picks) {
        // Sum predicted points for starting 11 only (bench players have multiplier 0)
        predictedPoints = picksResult.value.picks.reduce((sum, pick) => {
          if (pick.multiplier <= 0) return sum;
          const pts = playerPointsMap[pick.element] || 0;
          return sum + pts * pick.multiplier;
        }, 0);
        predictedPoints = parseFloat(predictedPoints.toFixed(1));
      }
      return { ...entry, predicted_points: predictedPoints };
    });

    res.json({
      league: standingsData.league,
      standings: {
        ...standingsData.standings,
        results: standingsWithPredictions,
      },
      currentGameweek: currentEvent.id,
      gameweeksAhead,
    });
  } catch (error) {
    console.error('Error fetching league standings:', error.message);
    res.status(500).json({ error: 'Error fetching league standings' });
  }
};

module.exports = {
  getBootstrapStatic,
  getFixtures,
  getPlayerPicks,
  getElementSummary,
  getLiveGameweek,
  getPredictedTeam,
  getUserTeam,
  getUserProfile,
  getAllPlayersEnriched,
  validateSwap,
  getAvailableTransfers,
  getRecommendedTransfers,
  getLeagueStandings
};
