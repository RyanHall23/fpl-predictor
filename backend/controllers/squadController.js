const Squad = require('../models/squadModel');
const SquadHistory = require('../models/squadHistoryModel');
const Chip = require('../models/chipModel');
const dataProvider = require('../models/dataProvider');
const { validateObjectId, validateEntryId, validateGameweek } = require('../utils/validation');

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
    
    // Validate inputs to prevent NoSQL injection
    const validatedUserId = validateObjectId(userId);
    const validatedEntryId = validateEntryId(entryId);
    const validatedGameweek = validateGameweek(gameweek);
    
    // Check if squad already exists
    const existingSquad = await Squad.findOne({ userId: validatedUserId });
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
        purchasePrice: player.now_cost, // Current price becomes purchase price for initialization
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
    const squad = new Squad({
      userId,
      gameweek,
      players,
      bank,
      squadValue: squadValue + bank,
      freeTransfers: 1,
      transfersMadeThisWeek: 0,
      pointsDeducted: 0,
      activeChip: null
    });
    
    await squad.save();
    
    // Initialize chip tracking for user
    const chips = new Chip({ userId });
    await chips.save();
    
    // Create initial history snapshot
    const history = new SquadHistory({
      userId,
      gameweek,
      snapshotType: 'regular',
      players: squad.players,
      bank: squad.bank,
      squadValue: squad.squadValue,
      freeTransfers: squad.freeTransfers,
      transfersMadeThisWeek: 0,
      pointsDeducted: 0,
      activeChip: null,
      pointsScored: picksData.entry_history?.points || 0
    });
    
    await history.save();
    
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
    
    // Validate to prevent NoSQL injection
    const validatedUserId = validateObjectId(userId);
    
    const squad = await Squad.findOne({ userId: validatedUserId });
    if (!squad) {
      return res.status(404).json({ error: 'Squad not found' });
    }
    
    // Fetch current player prices from API
    const bootstrapData = await dataProvider.fetchBootstrapStatic();
    const playerMap = {};
    bootstrapData.elements.forEach(player => {
      playerMap[player.id] = player;
    });
    
    // Update current prices and calculate selling prices
    const playersWithValues = squad.players.map(player => {
      const currentPlayer = playerMap[player.playerId];
      if (currentPlayer) {
        player.currentPrice = currentPlayer.now_cost;
      }
      
      // Calculate selling price
      const profit = player.currentPrice - player.purchasePrice;
      const profitToKeep = profit > 0 ? Math.floor(profit / 2) : 0;
      const sellingPrice = player.purchasePrice + profitToKeep;
      
      return {
        ...player.toObject(),
        sellingPrice,
        profit: player.currentPrice - player.purchasePrice
      };
    });
    
    const totalSellingValue = playersWithValues.reduce((sum, p) => sum + p.sellingPrice, 0) + squad.bank;
    const totalCurrentValue = playersWithValues.reduce((sum, p) => sum + p.currentPrice, 0) + squad.bank;
    
    res.json({
      ...squad.toObject(),
      players: playersWithValues,
      totalSellingValue,
      totalCurrentValue,
      transferCost: squad.getTransferCost()
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
    
    // Validate to prevent NoSQL injection
    const validatedUserId = validateObjectId(userId);
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
    
    // Validate to prevent NoSQL injection
    const validatedUserId = validateObjectId(userId);
    
    const history = await SquadHistory.find({ userId: validatedUserId }).sort({ gameweek: 1 });
    
    res.json(history);
  } catch (error) {
    console.error('Error getting squad history:', error);
    res.status(500).json({ error: 'Error getting squad history', details: error.message });
  }
};

/**
 * Update squad for new gameweek
 * This should be called at the start of each gameweek to:
 * - Reset transfers made this week
 * - Update free transfers (carry over 1 if none used, max 2)
 * - Reset active chip (except Free Hit which auto-reverts)
 * - Create new history snapshot
 */
const updateForNewGameweek = async (req, res) => {
  try {
    const { userId, newGameweek } = req.body;
    
    if (!userId || !newGameweek) {
      return res.status(400).json({ error: 'Missing required fields: userId, newGameweek' });
    }
    
    // Validate to prevent NoSQL injection
    const validatedUserId = validateObjectId(userId);
    const validatedGameweek = validateGameweek(newGameweek);
    
    const squad = await Squad.findOne({ userId: validatedUserId });
    if (!squad) {
      return res.status(404).json({ error: 'Squad not found' });
    }
    
    // If Free Hit was active, revert to previous gameweek's squad
    if (squad.activeChip === 'free_hit') {
      const previousHistory = await SquadHistory.findOne({ 
        userId: validatedUserId, 
        gameweek: validatedGameweek - 1 
      });
      
      if (previousHistory) {
        squad.players = previousHistory.players;
        squad.bank = previousHistory.bank;
        squad.squadValue = previousHistory.squadValue;
      }
    }
    
    // Update free transfers
    if (squad.transfersMadeThisWeek === 0) {
      // No transfers made, carry over 1 (max 2)
      squad.freeTransfers = Math.min(squad.freeTransfers + 1, 2);
    } else {
      // Transfers were made, reset to 1
      squad.freeTransfers = 1;
    }
    
    // Reset weekly counters
    squad.gameweek = newGameweek;
    squad.transfersMadeThisWeek = 0;
    squad.pointsDeducted = 0;
    
    // Clear active chip (chips are one-time use per gameweek)
    squad.activeChip = null;
    
    await squad.save();
    
    res.json({
      message: 'Squad updated for new gameweek',
      squad
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
