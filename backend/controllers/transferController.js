const Squad = require('../models/squadModel');
const SquadHistory = require('../models/squadHistoryModel');
const Transfer = require('../models/transferModel');
const Chip = require('../models/chipModel');
const dataProvider = require('../models/dataProvider');
const { validateObjectId, validateGameweek, validatePlayerId } = require('../utils/validation');

/**
 * Make a transfer (swap one player for another)
 */
const makeTransfer = async (req, res) => {
  try {
    const { userId, playerOutId, playerInId, gameweek } = req.body;
    
    if (!userId || !playerOutId || !playerInId || !gameweek) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, playerOutId, playerInId, gameweek' 
      });
    }
    
    // Validate to prevent NoSQL injection
    const validatedUserId = validateObjectId(userId);
    const validatedPlayerOutId = validatePlayerId(playerOutId);
    const validatedPlayerInId = validatePlayerId(playerInId);
    const validatedGameweek = validateGameweek(gameweek);
    
    // Get squad
    const squad = await Squad.findOne({ userId: validatedUserId });
    if (!squad) {
      return res.status(404).json({ error: 'Squad not found' });
    }
    
    if (squad.gameweek !== validatedGameweek) {
      return res.status(400).json({ 
        error: `Squad is on gameweek ${squad.gameweek}, but transfer requested for gameweek ${validatedGameweek}` 
      });
    }
    
    // Find player to remove
    const playerOutIndex = squad.players.findIndex(p => p.playerId === validatedPlayerOutId);
    if (playerOutIndex === -1) {
      return res.status(400).json({ error: 'Player to remove not found in squad' });
    }
    
    const playerOut = squad.players[playerOutIndex];
    
    // Fetch current player data
    const bootstrapData = await dataProvider.fetchBootstrapStatic();
    const playerMap = {};
    bootstrapData.elements.forEach(player => {
      playerMap[player.id] = player;
    });
    
    const playerInData = playerMap[validatedPlayerInId];
    if (!playerInData) {
      return res.status(400).json({ error: 'Player to add not found' });
    }
    
    const playerOutData = playerMap[validatedPlayerOutId];
    if (!playerOutData) {
      return res.status(400).json({ error: 'Player to remove data not found' });
    }
    
    // Check if players are same position type
    if (playerInData.element_type !== playerOutData.element_type) {
      return res.status(400).json({ 
        error: 'Cannot swap players of different positions' 
      });
    }
    
    // Calculate selling price for player out
    const profit = playerOut.currentPrice - playerOut.purchasePrice;
    const profitToKeep = profit > 0 ? Math.floor(profit / 2) : 0;
    const sellingPrice = playerOut.purchasePrice + profitToKeep;
    
    // Calculate new bank balance
    const newBank = squad.bank + sellingPrice - playerInData.now_cost;
    
    if (newBank < 0) {
      return res.status(400).json({ 
        error: 'Insufficient funds for this transfer',
        details: {
          bank: squad.bank,
          sellingPrice,
          playerInCost: playerInData.now_cost,
          shortfall: Math.abs(newBank)
        }
      });
    }
    
    // Check transfer costs
    const isWildcardActive = squad.activeChip === 'wildcard';
    const isFreeHitActive = squad.activeChip === 'free_hit';
    const isFreeTransfer = squad.transfersMadeThisWeek < squad.freeTransfers;
    
    let pointsCost = 0;
    if (!isWildcardActive && !isFreeHitActive && !isFreeTransfer) {
      pointsCost = 4; // 4 points for extra transfer
    }
    
    // Update squad
    squad.players[playerOutIndex] = {
      playerId: validatedPlayerInId,
      position: playerOut.position, // Keep same position
      purchasePrice: playerInData.now_cost,
      currentPrice: playerInData.now_cost,
      isCaptain: playerOut.isCaptain,
      isViceCaptain: playerOut.isViceCaptain,
      multiplier: playerOut.multiplier
    };
    
    squad.bank = newBank;
    squad.transfersMadeThisWeek += 1;
    squad.pointsDeducted += pointsCost;
    
    // Recalculate squad value
    squad.squadValue = squad.players.reduce((sum, p) => sum + p.currentPrice, 0) + squad.bank;
    
    await squad.save();
    
    // Record transfer in history
    const transfer = new Transfer({
      userId: validatedUserId,
      gameweek: validatedGameweek,
      playerIn: {
        playerId: validatedPlayerInId,
        price: playerInData.now_cost
      },
      playerOut: {
        playerId: validatedPlayerOutId,
        purchasePrice: playerOut.purchasePrice,
        sellingPrice
      },
      isFree: isFreeTransfer || isWildcardActive || isFreeHitActive,
      pointsCost,
      chipActive: squad.activeChip
    });
    
    await transfer.save();
    
    res.json({
      message: 'Transfer completed successfully',
      transfer,
      squad: {
        players: squad.players,
        bank: squad.bank,
        squadValue: squad.squadValue,
        transfersMadeThisWeek: squad.transfersMadeThisWeek,
        freeTransfers: squad.freeTransfers,
        pointsDeducted: squad.pointsDeducted
      },
      playerIn: {
        id: validatedPlayerInId,
        name: `${playerInData.first_name} ${playerInData.second_name}`,
        cost: playerInData.now_cost
      },
      playerOut: {
        id: validatedPlayerOutId,
        name: `${playerOutData.first_name} ${playerOutData.second_name}`,
        sellingPrice
      }
    });
  } catch (error) {
    console.error('Error making transfer:', error);
    res.status(500).json({ error: 'Error making transfer', details: error.message });
  }
};

/**
 * Get transfer history for a user
 */
const getTransferHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { gameweek, limit } = req.query;
    
    // Validate to prevent NoSQL injection
    const validatedUserId = validateObjectId(userId);
    
    let query = { userId: validatedUserId };
    if (gameweek) {
      const validatedGameweek = validateGameweek(gameweek);
      query.gameweek = validatedGameweek;
    }
    
    let transferQuery = Transfer.find(query).sort({ createdAt: -1 });
    if (limit) {
      transferQuery = transferQuery.limit(parseInt(limit));
    }
    
    const transfers = await transferQuery;
    
    // Fetch player names
    const bootstrapData = await dataProvider.fetchBootstrapStatic();
    const playerMap = {};
    bootstrapData.elements.forEach(player => {
      playerMap[player.id] = player;
    });
    
    const transfersWithNames = transfers.map(transfer => {
      const playerIn = playerMap[transfer.playerIn.playerId];
      const playerOut = playerMap[transfer.playerOut.playerId];
      
      return {
        ...transfer.toObject(),
        playerIn: {
          ...transfer.playerIn,
          name: playerIn ? `${playerIn.first_name} ${playerIn.second_name}` : 'Unknown',
          webName: playerIn ? playerIn.web_name : 'Unknown'
        },
        playerOut: {
          ...transfer.playerOut,
          name: playerOut ? `${playerOut.first_name} ${playerOut.second_name}` : 'Unknown',
          webName: playerOut ? playerOut.web_name : 'Unknown'
        }
      };
    });
    
    res.json(transfersWithNames);
  } catch (error) {
    console.error('Error getting transfer history:', error);
    res.status(500).json({ error: 'Error getting transfer history', details: error.message });
  }
};

/**
 * Get transfer summary for a gameweek
 */
const getTransferSummary = async (req, res) => {
  try {
    const { userId, gameweek } = req.params;
    
    // Validate to prevent NoSQL injection
    const validatedUserId = validateObjectId(userId);
    const validatedGameweek = validateGameweek(gameweek);
    
    const transfers = await Transfer.find({ 
      userId: validatedUserId, 
      gameweek: validatedGameweek 
    });
    
    const totalPointsCost = transfers.reduce((sum, t) => sum + t.pointsCost, 0);
    const freeTransfers = transfers.filter(t => t.isFree).length;
    const paidTransfers = transfers.filter(t => !t.isFree).length;
    
    res.json({
      gameweek: validatedGameweek,
      totalTransfers: transfers.length,
      freeTransfers,
      paidTransfers,
      totalPointsCost,
      transfers
    });
  } catch (error) {
    console.error('Error getting transfer summary:', error);
    res.status(500).json({ error: 'Error getting transfer summary', details: error.message });
  }
};

module.exports = {
  makeTransfer,
  getTransferHistory,
  getTransferSummary
};
