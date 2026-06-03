const fplModel = require('../models/fplModel');
const dataProvider = require('../models/dataProvider');
const { buildBreakdown } = require('../utils/statsBreakdown');

/**
 * Format a player's opponent(s) as a human-readable display string.
 * E.g. "MCI (H)" or "LIV (A) ARS (H)" for a DGW.
 *
 * Mirrors the buildOpponentDisplay helper previously in
 * frontend/src/hooks/useAllPlayers.js so the backend returns a ready-to-use
 * string and the frontend does not need to duplicate the formatting logic.
 *
 * @param {Object} player - Enriched player object with opponents/opponent_short/is_home.
 * @returns {string}
 */
const buildOpponentDisplay = (player) => {
  if (player.opponents && player.opponents.length > 0) {
    return player.opponents.map(opp => {
      const name = opp.opponent_short || '-';
      if (opp.is_home === null || opp.is_home === undefined) return name;
      return opp.is_home ? `${name} (H)` : `${name} (A)`;
    }).join(' ');
  }
  const opp = player.opponent_short || '-';
  if (opp === '-' || player.is_home === null || player.is_home === undefined) return opp;
  return player.is_home ? `${opp} (H)` : `${opp} (A)`;
};


// applyPredictionsWithCache is exported from fplModel and used throughout this module.
const applyPredictionsWithCache = fplModel.applyPredictionsWithCache;

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

    const elementsById = {};
    (bootstrap.elements || []).forEach(e => { elementsById[e.id] = e; });

    const enrichStats = (stats) => {
      if (!stats?.length) return [];
      return stats
        .filter(s => s.identifier === 'goals_scored' || s.identifier === 'assists')
        .map(s => ({
          identifier: s.identifier,
          h: (s.h || []).map(entry => ({
            element: entry.element,
            value: entry.value,
            webName: elementsById[entry.element]?.web_name || '',
            shortName: elementsById[entry.element]?.web_name || '',
          })),
          a: (s.a || []).map(entry => ({
            element: entry.element,
            value: entry.value,
            webName: elementsById[entry.element]?.web_name || '',
            shortName: elementsById[entry.element]?.web_name || '',
          })),
        }));
    };

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
      stats: enrichStats(f.stats),
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
    const [data, bootstrap] = await Promise.all([
      fplModel.fetchElementSummary(playerId),
      fplModel.fetchBootstrapStatic(),
    ]);

    // Look up the player's position (element_type) from bootstrap-static so that
    // the per-stat FPL points breakdown can be computed server-side.
    const playerMeta = bootstrap.elements.find(p => p.id === parseInt(playerId, 10));
    const position = playerMeta?.element_type ?? null;

    // Enrich each history entry with a pre-computed points breakdown so the
    // frontend does not need to implement FPL scoring rules itself.
    const enrichedHistory = position != null
      ? (data.history ?? []).map(entry => ({
          ...entry,
          breakdown: buildBreakdown(entry, position),
        }))
      : data.history;

    res.json({ ...data, history: enrichedHistory });
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
    const [data, fixtures] = await Promise.all([
      fplModel.fetchBootstrapStatic(),
      fplModel.fetchFixtures(),
    ]);
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
    const isPastGameweek = !!(targetEventData && targetEventData.finished);
    const isActiveGameweek = !!(targetEventData && targetEventData.is_current && !targetEventData.finished);
    const isFutureGameweek = targetEvent > currentEvent.id;
    
    let players = data.elements.map((p) => ({
      ...p,
      ep_next: parseFloat(p.ep_next) || 0,
    }));
    
    // For past or active gameweeks, enrich with live/actual points
    if (isPastGameweek || isActiveGameweek) {
      players = await fplModel.enrichPlayersWithGameweekStats(players, targetEvent);
    }
    
    // Enrich players with opponent display data (opponent name, home/away, DGW support)
    players = fplModel.enrichPlayersWithOpponents(players, fixtures, data.teams, targetEvent);
    
    // For non-past/non-active gameweeks, use stored predictions first, then fall
    // back to the full prediction engine.
    if (!isPastGameweek && !isActiveGameweek) {
      players = await applyPredictionsWithCache(players, fixtures, data.teams, targetEvent, 'predicted-team');
    }
    
    // Build team based on actual points (past/active) or predictions (current/future)
    const team = fplModel.buildHighestPredictedTeam(players, isPastGameweek || isActiveGameweek);

    res.json({
      ...team.toJSON(),
      gameweek: targetEvent,
      currentGameweek: currentEvent.id,
      isPastGameweek,
      isActiveGameweek,
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
    const [bootstrap, fixtures] = await Promise.all([
      fplModel.fetchBootstrapStatic(),
      fplModel.fetchFixtures(),
    ]);

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
    const isPastGameweek = !!(targetEventData && targetEventData.finished);
    // Active gameweek: deadline has passed (is_current) but games not yet finished
    const isActiveGameweek = !!(targetEventData && targetEventData.is_current && !targetEventData.finished);
    
    // For past or active gameweeks, enrich with live/actual points
    if (isPastGameweek || isActiveGameweek) {
      players = await fplModel.enrichPlayersWithGameweekStats(players, targetEvent);
    }
    
    // Enrich players with opponent display data for the target gameweek
    players = fplModel.enrichPlayersWithOpponents(players, fixtures, bootstrap.teams, targetEvent);
    
    // For non-past/non-active gameweeks, use stored predictions first, then fall
    // back to the full prediction engine.
    if (!isPastGameweek && !isActiveGameweek) {
      players = await applyPredictionsWithCache(players, fixtures, bootstrap.teams, targetEvent, 'user-team');
    }
    
    const team = fplModel.buildUserTeam(players, picksData.picks, isPastGameweek || isActiveGameweek, isFutureGameweek);

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
      ...team.toJSON(),
      teamName,
      gameweek: targetEvent,
      currentGameweek: currentEvent.id,
      isPastGameweek,
      isActiveGameweek,
      isFutureGameweek,
      gameweekData: targetEventData,
    });
  } catch (error) {
    console.error('Error building user team:', error);
    res.status(500).json({ error: 'Error building user team' });
  }
};

/**
 * GET /api/entry/:entryId/team[?gameweek=X]
 *
 * Variant of getUserTeam that does not require an event ID in the URL.
 * The current gameweek is resolved internally from bootstrap-static, so the
 * frontend never needs to call /api/bootstrap-static just to discover the
 * current event.  An optional `gameweek` query parameter overrides the
 * resolved event for viewing past / future GWs.
 */
const getUserTeamForEntry = async (req, res) => {
  const { entryId } = req.params;
  const { gameweek } = req.query;

  if (!/^\d+$/.test(entryId)) {
    return res.status(400).json({ error: 'Invalid entryId' });
  }

  try {
    const bootstrap = await fplModel.fetchBootstrapStatic();
    const currentEvent = bootstrap.events.find(e => e.is_current) || bootstrap.events.find(e => !e.finished) || bootstrap.events[0];
    if (!currentEvent) {
      return res.status(500).json({ error: 'Could not determine current gameweek' });
    }

    let targetEvent;
    if (gameweek !== undefined) {
      if (!/^\d+$/.test(gameweek)) {
        return res.status(400).json({ error: 'Invalid gameweek' });
      }
      targetEvent = parseInt(gameweek, 10);
    } else {
      targetEvent = currentEvent.id;
    }

    if (targetEvent < 1 || targetEvent > 38) {
      return res.status(400).json({ error: 'Gameweek must be between 1 and 38' });
    }

    const targetEventData = bootstrap.events.find(e => e.id === targetEvent);
    const isFutureGameweek = targetEvent > currentEvent.id;

    // For future GWs use current picks (future picks don't exist in the FPL API)
    const picksEventId = isFutureGameweek ? currentEvent.id : targetEvent;

    // Fetch fixtures, picks, transfers, and entry history in parallel — none depend on each other.
    const [fixturesResult, picksResult, transfersResult, historyResult] = await Promise.allSettled([
      fplModel.fetchFixtures(),
      fplModel.fetchPlayerPicks(entryId, picksEventId),
      dataProvider.fetchEntryTransfers(entryId),
      dataProvider.fetchHistory(entryId),
    ]);

    if (fixturesResult.status === 'rejected') {
      console.error(
        `Error fetching fixtures for entry ${entryId}, GW${targetEvent}:`,
        fixturesResult.reason?.message || 'Unknown error'
      );
      return res.status(500).json({ error: `Failed to fetch fixture data for GW${targetEvent}` });
    }
    const fixtures = fixturesResult.value;

    if (picksResult.status === 'rejected') {
      console.error(`Error fetching picks for gameweek ${picksEventId}:`, picksResult.reason?.message);
      return res.status(500).json({ error: 'Error fetching team picks' });
    }
    const picksData = picksResult.value;

    // Fetch transfer history to calculate accurate selling prices.
    // FPL rule: selling_price = purchase_price + floor((now_cost - purchase_price) / 2)
    // If price dropped below purchase: selling_price = now_cost (full loss, no profit share).
    // For original squad members (never transferred): purchase_price = now_cost - cost_change_start.
    let purchasePriceMap = {};
    if (transfersResult.status === 'fulfilled') {
      const transfers = transfersResult.value;
      // Sort ascending by event so later transfers overwrite earlier ones —
      // handles sell-and-rebuy: the most recent transfer-in cost wins.
      const sorted = [...transfers].sort((a, b) => {
        if (a.event !== b.event) return a.event - b.event;
        return (a.time ?? '').localeCompare(b.time ?? '');
      });
      for (const t of sorted) {
        purchasePriceMap[t.element_in] = t.element_in_cost;
      }
    }
    // Non-fatal if transfers failed — will fall back to start-of-season price for all players

    let players = bootstrap.elements.map((p) => {
      // Determine purchase price: transfer record takes priority; otherwise use
      // the season-start price derived from cost_change_start.
      const purchasePrice = purchasePriceMap[p.id] ?? (p.now_cost - (p.cost_change_start ?? 0));
      const sellingPrice = p.now_cost >= purchasePrice
        ? purchasePrice + Math.floor((p.now_cost - purchasePrice) / 2)
        : p.now_cost;
      return {
        ...p,
        ep_next: parseFloat(p.ep_next) || 0,
        purchase_price: purchasePrice,
        selling_price: sellingPrice,
      };
    });

    const isPastGameweek = !!(targetEventData && targetEventData.finished);
    const isActiveGameweek = !!(targetEventData && targetEventData.is_current && !targetEventData.finished);

    if (isPastGameweek || isActiveGameweek) {
      players = await fplModel.enrichPlayersWithGameweekStats(players, targetEvent);
    }

    players = fplModel.enrichPlayersWithOpponents(players, fixtures, bootstrap.teams, targetEvent);

    if (!isPastGameweek && !isActiveGameweek) {
      players = await applyPredictionsWithCache(players, fixtures, bootstrap.teams, targetEvent, 'user-team-entry');
    }

    const team = fplModel.buildUserTeam(players, picksData.picks, isPastGameweek || isActiveGameweek, isFutureGameweek);

    let teamName = '';
    try {
      const entryData = await dataProvider.fetchEntry(entryId);
      if (entryData.player_first_name) {
        teamName = `${entryData.player_first_name} ${entryData.player_last_name}`;
      }
    } catch {
      teamName = '';
    }

    // Calculate free transfers available at the start of targetEvent from historical data.
    // Rule: start with 1 FT; each GW ft = min(2, max(0, ft - transfers_made) + 1)
    // Chip exceptions: Free Hit treats transfers as 0 (squad reverts); Wildcard resets next GW to 1.
    let freeTransfers = 1;
    if (historyResult.status === 'fulfilled') {
      try {
        const historyData = historyResult.value;
        const gwHistory = (historyData.current || []).sort((a, b) => a.event - b.event);
        let ft = 1;
        for (const gw of gwHistory) {
          if (gw.event >= targetEvent) break;
          if (gw.event_chip === 'freehit') {
            ft = Math.min(2, ft + 1);
          } else if (gw.event_chip === 'wildcard') {
            ft = 1;
          } else {
            const remaining = Math.max(0, ft - (gw.event_transfers || 0));
            ft = Math.min(2, remaining + 1);
          }
        }
        freeTransfers = ft;
      } catch {
        freeTransfers = 1;
      }
    }

    res.json({
      ...team.toJSON(),
      teamName,
      gameweek: targetEvent,
      currentGameweek: currentEvent.id,
      isPastGameweek,
      isActiveGameweek,
      isFutureGameweek,
      gameweekData: targetEventData,
      freeTransfers,
      bank: picksData.entry_history?.bank ?? null,
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
      history: historyData.current || [],
      chips: historyData.chips || [],
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

    // For past or active gameweeks, enrich with actual points from the live endpoint
    // so that event_points reflects the correct GW score for every player.
    const targetEventData = data.events.find(e => e.id === targetEvent);
    const isPastOrActive = !!(targetEventData && (targetEventData.finished || targetEventData.is_current));
    if (isPastOrActive) {
      players = await fplModel.enrichPlayersWithGameweekStats(players, targetEvent);
    }
    
    // Enrich players with opponent display data for the target gameweek
    players = fplModel.enrichPlayersWithOpponents(players, fixtures, data.teams, targetEvent);
    
    // Apply the advanced prediction engine for future gameweeks only.
    if (!isPastOrActive) {
      players = await applyPredictionsWithCache(players, fixtures, data.teams, targetEvent, 'enriched');
    }

    // Add a pre-formatted opponent display string so the frontend does not need
    // to duplicate the formatting logic for single vs DGW fixtures.
    players = players.map(p => ({
      ...p,
      opponent_display: buildOpponentDisplay(p),
    }));
    
    res.json({ elements: players, teams: data.teams, events: data.events });
  } catch (error) {
    console.error('Error fetching enriched players:', error);
    res.status(500).json({ error: 'Error fetching enriched players' });
  }
};

const validateSwap = async (req, res) => {
  try {
    const { player1, player2, zone1, zone2, activePlayers, reservePlayers } = req.body;
    
    if (!player1 || !player2 || !zone1 || !zone2 || !activePlayers || !reservePlayers) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const result = fplModel.validateSwap(player1, player2, zone1, zone2, activePlayers, reservePlayers);
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
 * @param {string} gameweeksAhead - Number of gameweeks to forecast (1-5, default 1)
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
  
  // Validate gameweeksAhead (1-5, default 1)
  let lookahead = 1;
  if (gameweeksAhead !== undefined) {
    if (!/^\d+$/.test(gameweeksAhead)) {
      return res.status(400).json({ error: 'Invalid gameweeksAhead parameter' });
    }
    lookahead = parseInt(gameweeksAhead, 10);
    if (lookahead < 1 || lookahead > MAX_GAMEWEEKS_AHEAD) {
      return res.status(400).json({ error: `gameweeksAhead must be between 1 and ${MAX_GAMEWEEKS_AHEAD}` });
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

    // Build purchase-price map from transfer history (single cached API call).
    // For each player transferred in, the cost at transfer time is stored directly.
    // Original squad members (never transferred) use the season-start price derived
    // from now_cost - cost_change_start, mirroring the logic in getUserTeamForEntry.
    let purchasePriceMap = {};
    try {
      const transfers = await dataProvider.fetchEntryTransfers(entryId);
      const sorted = [...transfers].sort((a, b) => {
        if (a.event !== b.event) return a.event - b.event;
        return (a.time ?? '').localeCompare(b.time ?? '');
      });
      for (const t of sorted) {
        purchasePriceMap[t.element_in] = t.element_in_cost;
      }
    } catch {
      // Non-fatal: transfer history unavailable; squad members will have their
      // season-start price (now_cost - cost_change_start) filled in below.
    }

    // Fill in season-start prices for players not found in transfer history
    const currentPlayerIds = picksData.picks.map(p => p.element);
    currentPlayerIds.forEach(playerId => {
      if (!(playerId in purchasePriceMap)) {
        const playerData = bootstrap.elements.find(p => p.id === playerId);
        if (playerData) {
          purchasePriceMap[playerId] = playerData.now_cost - (playerData.cost_change_start ?? 0);
        }
      }
    });

    // Build base player list
    let allPlayers = bootstrap.elements.map((p) => ({
      ...p,
      ep_next: parseFloat(p.ep_next) || 0,
    }));

    // Compute cumulative predicted points for each player across the GW range using
    // stored predictions where available (avoids re-running the full engine per GW).
    const playerPointsMap = await buildPlayerPointsMap(
      allPlayers, fixtures, bootstrap.teams, currentEvent.id, lookahead
    );

    // Apply cumulative points and enrich with opponent data for the first upcoming GW
    allPlayers = fplModel.enrichPlayersWithOpponents(
      allPlayers.map(p => ({
        ...p,
        ep_next: playerPointsMap[p.id] ?? parseFloat(p.ep_next) ?? 0,
      })),
      fixtures, bootstrap.teams, startEvent
    );
    
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
          // Calculate selling price using FPL rules.
          // purchasePriceMap now stores the raw purchase price as a number.
          const rawPurchasePrice = purchasePriceMap[weakPlayer.id] ?? null;
          const purchasePrice = rawPurchasePrice ?? weakPlayer.now_cost;
          const currentPrice = weakPlayer.now_cost;
          const sellingPrice = currentPrice <= purchasePrice
            ? currentPrice
            : purchasePrice + Math.floor((currentPrice - purchasePrice) / 2);

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
 *
 * For GW+1 (the most common case), we read the predictions file produced by
 * the daily CI job (.github/workflows/fetch-season-data.yml, runs at 08:00 UTC).
 * This avoids running the full Monte Carlo engine on every request.
 * For additional GWs beyond that file, or when the file is absent, we fall
 * back to live computation.
 *
 * @param {Array} allPlayers - Enriched player list
 * @param {Array} fixtures - Fixture list
 * @param {Array} teams - Team list
 * @param {number} currentEventId - Current gameweek ID
 * @param {number} gameweeksAhead - Number of gameweeks ahead to sum (1-5)
 * @returns {Object} Map of playerId -> cumulative predicted points
 */
async function buildPlayerPointsMap(allPlayers, fixtures, teams, currentEventId, gameweeksAhead) {
  const playerPointsMap = {};
  const startEvent = currentEventId + 1;
  const endEvent = Math.min(currentEventId + gameweeksAhead, 38);

  for (let gw = startEvent; gw <= endEvent; gw++) {
    // Enrich with opponent data for this GW, then apply predictions via the
    // shared helper (stored cache → live engine fallback) so the caching and
    // staleness rules stay in one place.
    let gwPlayers = fplModel.enrichPlayersWithOpponents(
      allPlayers.map(p => ({ ...p })), fixtures, teams, gw
    );
    gwPlayers = await fplModel.applyPredictionsWithCache(gwPlayers, fixtures, teams, gw, 'transfers');
    gwPlayers.forEach(p => {
      const pts = parseFloat(p.predicted_points ?? p.ep_next) || 0;
      playerPointsMap[p.id] = (playerPointsMap[p.id] || 0) + pts;
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
    const isActiveGw = !!currentEvent.is_current && !currentEvent.finished;

    // Build base player list enriched with predicted points
    let allPlayers = bootstrap.elements.map(p => ({
      ...p,
      ep_next: parseFloat(p.ep_next) || 0,
    }));

    // Pre-compute per-player cumulative predicted points map (future GWs)
    const playerPointsMap = await buildPlayerPointsMap(
      allPlayers, fixtures, bootstrap.teams, currentEvent.id, gameweeksAhead
    );

    // Fetch live GW data in parallel with team picks.
    // The FPL live endpoint updates in near-real-time during matches, so we use
    // it to compute each team's live GW score rather than relying on the
    // standings endpoint which only refreshes at end-of-day.
    const [liveGwData, picksResults] = await Promise.all([
      fplModel.fetchLiveGameweek(currentEvent.id).catch(() => null),
      Promise.allSettled(
        (standingsData.standings?.results || []).map(entry =>
          fplModel.fetchPlayerPicks(entry.entry, currentEvent.id)
        )
      ),
    ]);

    // Build map of elementId → live total_points from FPL live endpoint
    const livePointsMap = {};
    if (liveGwData?.elements) {
      liveGwData.elements.forEach(el => {
        livePointsMap[el.id] = el.stats?.total_points ?? 0;
      });
    }

    const entries = standingsData.standings?.results || [];

    const standingsWithPredictions = entries.map((entry, i) => {
      let predictedPoints = null;
      let livePoints = null;
      const picksResult = picksResults[i];
      if (picksResult.status === 'fulfilled' && picksResult.value?.picks) {
        const picks = picksResult.value.picks;

        // Future GW predictions (existing logic)
        predictedPoints = picks.reduce((sum, pick) => {
          if (pick.multiplier <= 0) return sum;
          const pts = playerPointsMap[pick.element] || 0;
          return sum + pts * pick.multiplier;
        }, 0);
        predictedPoints = parseFloat(predictedPoints.toFixed(1));

        // Live GW points — sum actual live points respecting captain multiplier
        if (Object.keys(livePointsMap).length > 0) {
          livePoints = picks.reduce((sum, pick) => {
            if (pick.multiplier <= 0) return sum;
            const pts = livePointsMap[pick.element] || 0;
            return sum + pts * pick.multiplier;
          }, 0);
          livePoints = parseFloat(livePoints.toFixed(0));
        }
      }
      return { ...entry, predicted_points: predictedPoints, live_points: livePoints };
    });

    res.json({
      league: standingsData.league,
      standings: {
        ...standingsData.standings,
        results: standingsWithPredictions,
      },
      currentGameweek: currentEvent.id,
      isActiveGw,
      gameweeksAhead,
    });
  } catch (error) {
    console.error('Error fetching league standings:', error.message);
    res.status(500).json({ error: 'Error fetching league standings' });
  }
};

/**
 * GET /api/bootstrap-static/forecast?gameweeks=32,33,34
 *
 * Returns per-player predicted points and fixture data for one or more
 * specific gameweeks in a single request.
 *
 * This replaces the pattern where the frontend called
 * /api/bootstrap-static/enriched?gameweek=X once per gameweek to build
 * a multi-GW forecast.  A single aggregated call reduces round-trips and
 * keeps the per-GW prediction logic server-side.
 *
 * Response shape: { [gw]: { [playerCode]: { points, opponents } } }
 *
 * @param {string} gameweeks - Comma-separated gameweek numbers, e.g. "32,33,34".
 */
const getPlayersForecast = async (req, res) => {
  const { gameweeks } = req.query;

  if (!gameweeks) {
    return res.status(400).json({ error: 'Missing required gameweeks query parameter' });
  }

  const gwList = [...new Set(
    String(gameweeks)
      .split(',')
      .map(g => parseInt(g.trim(), 10))
      .filter(g => Number.isFinite(g) && g >= 1 && g <= 38)
  )];

  if (!gwList.length) {
    return res.status(400).json({ error: 'No valid gameweeks provided (must be integers between 1 and 38)' });
  }

  // Cap to a reasonable limit to prevent abuse
  const MAX_GWS = 10;
  if (gwList.length > MAX_GWS) {
    return res.status(400).json({ error: `Too many gameweeks requested (max ${MAX_GWS})` });
  }

  try {
    const [bootstrap, fixtures] = await Promise.all([
      fplModel.fetchBootstrapStatic(),
      fplModel.fetchFixtures(),
    ]);

    const result = {};

    for (const gw of gwList) {
      let players = bootstrap.elements.map(p => ({ ...p }));
      players = fplModel.enrichPlayersWithOpponents(players, fixtures, bootstrap.teams, gw);
      players = await fplModel.applyAdvancedPredictions(players, fixtures, bootstrap.teams, gw);

      const byCode = {};
      players.forEach(p => {
        byCode[p.code] = {
          points: parseFloat(p.ep_next) || 0,
          // enrichPlayersWithOpponents always sets opponents ([] when no fixture)
          opponents: p.opponents ?? [],
        };
      });
      result[gw] = byCode;
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching players forecast:', error.message);
    res.status(500).json({ error: 'Error fetching players forecast' });
  }
};

/**
 * GET /api/entry/:entryId/transfers?gameweek=N
 *
 * Returns the FPL transfers made by an entry for the given gameweek (or all
 * transfers if no gameweek is supplied).  Player names are resolved from
 * bootstrap-static so the frontend never needs to look them up separately.
 *
 * Response shape:
 * {
 *   transfers: Array<{ playerIn, playerOut, event, time }>,
 *   meta: { eventTransfers, transferCost } | null
 * }
 * where playerIn/Out = { id, name, webName, cost }
 */
const getEntryTransfers = async (req, res) => {
  const { entryId } = req.params;
  const { gameweek } = req.query;

  if (!/^\d+$/.test(entryId)) {
    return res.status(400).json({ error: 'Invalid entryId' });
  }

  let filterGW;
  if (gameweek !== undefined) {
    if (!/^\d+$/.test(gameweek)) {
      return res.status(400).json({ error: 'Invalid gameweek' });
    }
    filterGW = parseInt(gameweek, 10);
    if (filterGW < 1 || filterGW > 38) {
      return res.status(400).json({ error: 'Gameweek must be between 1 and 38' });
    }
  }

  try {
    const fetches = [
      fplModel.fetchBootstrapStatic(),
      dataProvider.fetchEntryTransfers(entryId),
    ];
    // Fetch picks for the specific GW so we can surface the transfer cost
    if (filterGW !== undefined) {
      fetches.push(dataProvider.fetchPlayerPicks(entryId, filterGW).catch(() => null));
    }
    const [bootstrap, allTransfers, picksData] = await Promise.all(fetches);

    const playerMap = {};
    for (const p of bootstrap.elements) {
      playerMap[p.id] = p;
    }

    const filtered = filterGW !== undefined
      ? allTransfers.filter(t => t.event === filterGW)
      : allTransfers;

    const transfers = filtered.map(t => {
      const pIn  = playerMap[t.element_in];
      const pOut = playerMap[t.element_out];
      return {
        event: t.event,
        time: t.time,
        playerIn: {
          id: t.element_in,
          name: pIn  ? `${pIn.first_name} ${pIn.second_name}`   : 'Unknown',
          webName: pIn  ? pIn.web_name  : 'Unknown',
          cost: t.element_in_cost,
        },
        playerOut: {
          id: t.element_out,
          name: pOut ? `${pOut.first_name} ${pOut.second_name}` : 'Unknown',
          webName: pOut ? pOut.web_name : 'Unknown',
          cost: t.element_out_cost,
        },
      };
    });

    // Include transfer cost metadata from picks entry_history when available
    const entryHistory = picksData?.entry_history ?? null;
    const meta = entryHistory ? {
      eventTransfers: entryHistory.event_transfers ?? transfers.length,
      transferCost: entryHistory.event_transfers_cost ?? 0,
    } : null;

    res.json({ transfers, meta });
  } catch (error) {
    console.error('Error fetching entry transfers:', error.message);
    res.status(500).json({ error: 'Error fetching entry transfers' });
  }
};

/**
 * GET /api/entry/:entryId/transfer-insights
 *
 * For each transfer the manager made this season, computes how many points
 * the transferred-in player scored from that gameweek to GW38, versus how
 * many points the transferred-out player scored over the same window.
 * Returns: { insights: [{ event, playerIn, playerOut, net }] }
 */
const getTransferInsights = async (req, res) => {
  const { entryId } = req.params;
  if (!/^\d+$/.test(entryId)) {
    return res.status(400).json({ error: 'Invalid entryId' });
  }

  try {
    const [bootstrap, allTransfers, historyData] = await Promise.all([
      fplModel.fetchBootstrapStatic(),
      dataProvider.fetchEntryTransfers(entryId),
      dataProvider.fetchHistory(entryId).catch(() => ({ chips: [] })),
    ]);

    if (!allTransfers.length) {
      return res.json({ insights: [] });
    }

    const playerMap = {};
    for (const p of bootstrap.elements) playerMap[p.id] = p;

    // Build a set of GWs where the Free Hit chip was active.
    // Transfers in a Free Hit GW are temporary — the squad reverts afterwards.
    const freeHitGWs = new Set(
      (historyData.chips || [])
        .filter(c => c.name === 'freehit')
        .map(c => c.event)
    );

    const playerIds = new Set();
    for (const t of allTransfers) {
      playerIds.add(t.element_in);
      playerIds.add(t.element_out);
    }

    const minGW = Math.min(...allTransfers.map(t => t.event));

    // Load all live GW files from minGW → 38 in parallel (local static files)
    const gwResults = await Promise.all(
      Array.from({ length: 38 - minGW + 1 }, (_, i) => minGW + i).map(gw =>
        dataProvider.fetchLiveGameweek(gw)
          .then(data => ({ gw, data }))
          .catch(() => ({ gw, data: null }))
      )
    );

    // playerPoints[id][gw] = points scored in that GW
    const playerPoints = {};
    for (const { gw, data } of gwResults) {
      if (!data?.elements) continue;
      for (const el of data.elements) {
        if (!playerIds.has(el.id)) continue;
        if (!playerPoints[el.id]) playerPoints[el.id] = {};
        playerPoints[el.id][gw] = el.stats?.total_points ?? 0;
      }
    }

    // Sort all transfers chronologically so we can derive ownership windows.
    const sortedTransfers = [...allTransfers].sort((a, b) =>
      a.event !== b.event ? a.event - b.event : new Date(a.time) - new Date(b.time)
    );

    // Track the next transfer where each player is sold (element_out) for each transfer-in row.
    // Reverse scan means the map always points to the nearest future sale.
    const nextSaleTransferByPlayer = {};
    const nextSaleByTransferIndex = new Array(sortedTransfers.length).fill(null);
    for (let i = sortedTransfers.length - 1; i >= 0; i--) {
      const t = sortedTransfers[i];
      nextSaleByTransferIndex[i] = nextSaleTransferByPlayer[t.element_in] ?? null;
      nextSaleTransferByPlayer[t.element_out] = t;
    }

    const insights = sortedTransfers.map((t, i) => {
      const pIn  = playerMap[t.element_in];
      const pOut = playerMap[t.element_out];

      // Free Hit transfers are temporary: the player is only present for that one GW.
      if (freeHitGWs.has(t.event)) {
        const inPts  = playerPoints[t.element_in]?.[t.event]  ?? 0;
        const outPts = playerPoints[t.element_out]?.[t.event] ?? 0;
        return {
          event: t.event,
          windowEnd: t.event,
          time: t.time,
          playerIn:  { id: t.element_in,  webName: pIn?.web_name  ?? 'Unknown', cost: t.element_in_cost,  pointsInWindow: inPts  },
          playerOut: { id: t.element_out, webName: pOut?.web_name ?? 'Unknown', cost: t.element_out_cost, pointsInWindow: outPts },
          net: inPts - outPts,
        };
      }

      // Ownership window: from transfer GW until the player was sold (exclusive), or GW38.
      const soldTransfer = nextSaleByTransferIndex[i]; // null means held to GW38
      const windowEnd = soldTransfer ? soldTransfer.event - 1 : 38;
      const windowEnd38 = Math.min(Math.max(windowEnd, t.event), 38);

      let inPts = 0, outPts = 0;
      for (let gw = t.event; gw <= windowEnd38; gw++) {
        inPts  += playerPoints[t.element_in]?.[gw]  ?? 0;
        outPts += playerPoints[t.element_out]?.[gw] ?? 0;
      }

      return {
        event: t.event,
        windowEnd: windowEnd38,
        time: t.time,
        playerIn:  { id: t.element_in,  webName: pIn?.web_name  ?? 'Unknown', cost: t.element_in_cost,  pointsInWindow: inPts  },
        playerOut: { id: t.element_out, webName: pOut?.web_name ?? 'Unknown', cost: t.element_out_cost, pointsInWindow: outPts },
        net: inPts - outPts,
      };
    });

    res.json({ insights });
  } catch (error) {
    console.error('Error computing transfer insights:', error.message);
    res.status(500).json({ error: 'Error computing transfer insights' });
  }
};

/**
 * GET /api/leagues-classic/:leagueId/race
 * Returns per-GW cumulative totals for the top N teams in a classic league,
 * enabling a bar-chart-race animation in the UI.
 */
const getLeagueRace = async (req, res) => {
  const { leagueId } = req.params;
  if (!/^\d+$/.test(leagueId)) {
    return res.status(400).json({ error: 'Invalid leagueId format' });
  }

  let limit = 10;
  if (req.query.limit !== undefined) {
    if (!/^\d+$/.test(req.query.limit)) {
      return res.status(400).json({ error: 'Invalid limit parameter' });
    }
    limit = parseInt(req.query.limit, 10);
    if (limit < 1 || limit > 20) {
      return res.status(400).json({ error: 'limit must be between 1 and 20' });
    }
  }

  try {
    const standingsData = await dataProvider.fetchLeagueStandings(leagueId);
    const topEntries = (standingsData.standings?.results || []).slice(0, limit);

    const histories = await Promise.allSettled(
      topEntries.map(entry => dataProvider.fetchHistory(entry.entry))
    );

    const entries = topEntries.map((entry, i) => {
      const histResult = histories[i];
      const gwHistory = histResult.status === 'fulfilled'
        ? (histResult.value.current || []).sort((a, b) => a.event - b.event)
        : [];
      return {
        entryId:    entry.entry,
        entryName:  entry.entry_name,
        playerName: entry.player_name,
        rank:       entry.rank,
        total:      entry.total,
        gwData: gwHistory.map(gw => ({
          event:        gw.event,
          points:       gw.points,
          total_points: gw.total_points,
        })),
      };
    });

    res.json({ league: standingsData.league, entries });
  } catch (error) {
    console.error('Error fetching league race data:', error.message);
    res.status(500).json({ error: 'Error fetching league race data' });
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
  getUserTeamForEntry,
  getUserProfile,
  getAllPlayersEnriched,
  validateSwap,
  getAvailableTransfers,
  getRecommendedTransfers,
  getLeagueStandings,
  getPlayersForecast,
  getEntryTransfers,
  getTransferInsights,
  getLeagueRace,
};
