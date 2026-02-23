const { Squad, getTransferCost, getSellingPrice } = require('../models/squadModel');
const SquadHistory = require('../models/squadHistoryModel');
const { Chip } = require('../models/chipModel');
const dataProvider = require('../models/dataProvider');
const { validateId, validateEntryId, validateGameweek } = require('../utils/validation');

/**
 * Initialize a user's squad from FPL API data
 * This should be called when a user first connects their FPL account
 */
const initializeSquad = async (req, res) => {
  try {
    const { userId, entryId, gameweek } = req.body;
    
    if (!userId || !entryId || !gameweek) {
      return res.status(400).json({ error: 'Missing required fields: userId, entryId, gameweek' });
    }
    
    const validatedUserId = validateId(userId);
    const validatedEntryId = validateEntryId(entryId);
    const validatedGameweek = validateGameweek(gameweek);
    
    // Check if squad already exists
    const existingSquad = await Squad.findByUserId(validatedUserId);
    if (existingSquad) {
      return res.status(400).json({ error: 'Squad already initialized for this user' });
    }
    
    // Fetch current picks from FPL API
    const picksData = await dataProvider.fetchPlayerPicks(validatedEntryId, validatedGameweek);
    const bootstrapData = await dataProvider.fetchBootstrapStatic();
    
    // Build player map for quick lookup
    const playerMap = {};
    bootstrapData.elements.forEach(player => {
      playerMap[player.id] = player;
    });
    
    // Convert picks to our squad format
    const players = picksData.picks.map(pick => {
      const player = playerMap[pick.element];
      if (!player) {
        throw new Error(`Player ${pick.element} not found in bootstrap data`);
      }
      
      return {
        playerId: pick.element,
        position: pick.position,
        purchasePrice: player.now_cost,
        currentPrice: player.now_cost,
        isCaptain: pick.is_captain || false,
        isViceCaptain: pick.is_vice_captain || false,
        multiplier: pick.multiplier || 1
      };
    });
    
    // Calculate squad value
    const squadValue = players.reduce((sum, p) => sum + p.currentPrice, 0);
    const bank = picksData.entry_history?.bank || 0;
    
    // Create squad
    const squad = await Squad.create({
      userId: validatedUserId,
      gameweek: validatedGameweek,
      players,
      bank,
      squadValue: squadValue + bank,
      freeTransfers: 1,
      transfersMadeThisWeek: 0,
      pointsDeducted: 0,
      activeChip: null
    });
    
    // Initialize chip tracking for user
    const chips = await Chip.create(validatedUserId);
    
    // Create initial history snapshot
    const history = await SquadHistory.create({
      userId: validatedUserId,
      gameweek: validatedGameweek,
      snapshotType: 'regular',
      players: squad.players,
      bank: squad.bank,
      squadValue: squad.squad_value,
      freeTransfers: squad.free_transfers,
      transfersMadeThisWeek: 0,
      pointsDeducted: 0,
      activeChip: null,
      pointsScored: picksData.entry_history?.points || 0
    });
    
    res.json({
      message: 'Squad initialized successfully',
      squad,
      chips
    });
  } catch (error) {
    console.error('Error initializing squad:', error);
    res.status(500).json({ error: 'Error initializing squad', details: error.message });
  }
};

/**
 * Get user's current squad with calculated values
 */
const getSquad = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const validatedUserId = validateId(userId);
    
    const squad = await Squad.findByUserId(validatedUserId);
    if (!squad) {
      return res.status(404).json({ error: 'Squad not found' });
    }
    
    // Fetch current player prices from API
    const bootstrapData = await dataProvider.fetchBootstrapStatic();
    const playerMap = {};
    bootstrapData.elements.forEach(player => {
      playerMap[player.id] = player;
    });
    
    const players = squad.players;

    // Update current prices and calculate selling prices
    const playersWithValues = players.map(player => {
      const currentPlayer = playerMap[player.playerId];
      if (currentPlayer) {
        player.currentPrice = currentPlayer.now_cost;
      }
      
      const sellingPrice = getSellingPrice(player.purchasePrice, player.currentPrice);
      
      return {
        ...player,
        sellingPrice,
        profit: player.currentPrice - player.purchasePrice
      };
    });
    
    const totalSellingValue = playersWithValues.reduce((sum, p) => sum + p.sellingPrice, 0) + squad.bank;
    const totalCurrentValue = playersWithValues.reduce((sum, p) => sum + p.currentPrice, 0) + squad.bank;
    
    res.json({
      ...squad,
      players: playersWithValues,
      totalSellingValue,
      totalCurrentValue,
      transferCost: getTransferCost(squad.active_chip, squad.transfers_made_this_week, squad.free_transfers)
    });
  } catch (error) {
    console.error('Error getting squad:', error);
    res.status(500).json({ error: 'Error getting squad', details: error.message });
  }
};

/**
 * Get squad history for a specific gameweek
 */
const getSquadHistory = async (req, res) => {
  try {
    const { userId, gameweek } = req.params;
    
    const validatedUserId = validateId(userId);
    const validatedGameweek = validateGameweek(gameweek);
    
    const history = await SquadHistory.findOne({ userId: validatedUserId, gameweek: validatedGameweek });
    if (!history) {
      return res.status(404).json({ error: 'Squad history not found for this gameweek' });
    }
    
    res.json(history);
  } catch (error) {
    console.error('Error getting squad history:', error);
    res.status(500).json({ error: 'Error getting squad history', details: error.message });
  }
};

/**
 * Get all squad history for a user
 */
const getAllSquadHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const validatedUserId = validateId(userId);
    
    const history = await SquadHistory.findAll({ userId: validatedUserId });
    
    res.json(history);
  } catch (error) {
    console.error('Error getting squad history:', error);
    res.status(500).json({ error: 'Error getting squad history', details: error.message });
  }
};

/**
 * Update squad for new gameweek
 */
const updateForNewGameweek = async (req, res) => {
  try {
    const { userId, newGameweek } = req.body;
    
    if (!userId || !newGameweek) {
      return res.status(400).json({ error: 'Missing required fields: userId, newGameweek' });
    }
    
    const validatedUserId = validateId(userId);
    const validatedGameweek = validateGameweek(newGameweek);
    
    const squad = await Squad.findByUserId(validatedUserId);
    if (!squad) {
      return res.status(404).json({ error: 'Squad not found' });
    }
    
    let players = squad.players;
    let bank = squad.bank;
    let squadValue = squad.squad_value;

    // If Free Hit was active, revert to previous gameweek's squad
    if (squad.active_chip === 'free_hit') {
      const previousHistory = await SquadHistory.findOne({ 
        userId: validatedUserId, 
        gameweek: validatedGameweek - 1 
      });
      
      if (previousHistory) {
        players = previousHistory.players;
        bank = previousHistory.bank;
        squadValue = previousHistory.squadValue;
      }
    }
    
    // Update free transfers
    let freeTransfers = squad.free_transfers;
    if (squad.transfers_made_this_week === 0) {
      freeTransfers = Math.min(freeTransfers + 1, 2);
    } else {
      freeTransfers = 1;
    }
    
    const updatedSquad = await Squad.updateByUserId(validatedUserId, {
      gameweek: validatedGameweek,
      players,
      bank,
      squadValue,
      freeTransfers,
      transfersMadeThisWeek: 0,
      pointsDeducted: 0,
      activeChip: null,
    });
    
    res.json({
      message: 'Squad updated for new gameweek',
      squad: updatedSquad
    });
  } catch (error) {
    console.error('Error updating squad for new gameweek:', error);
    res.status(500).json({ error: 'Error updating squad for new gameweek', details: error.message });
  }
};

module.exports = {
  initializeSquad,
  getSquad,
  getSquadHistory,
  getAllSquadHistory,
  updateForNewGameweek
};
