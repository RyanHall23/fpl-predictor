const { Squad, getSellingPrice } = require('../models/squadModel');
const Transfer = require('../models/transferModel');
const dataProvider = require('../models/dataProvider');
const { validateId, validateGameweek, validatePlayerId } = require('../utils/validation');

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
    
    const validatedUserId = validateId(userId);
    const validatedPlayerOutId = validatePlayerId(playerOutId);
    const validatedPlayerInId = validatePlayerId(playerInId);
    const validatedGameweek = validateGameweek(gameweek);
    
    // Get squad
    const squad = await Squad.findByUserId(validatedUserId);
    if (!squad) {
      return res.status(404).json({ error: 'Squad not found' });
    }
    
    if (squad.gameweek !== validatedGameweek) {
      return res.status(400).json({ 
        error: `Squad is on gameweek ${squad.gameweek}, but transfer requested for gameweek ${validatedGameweek}` 
      });
    }
    
    const players = squad.players;
    
    // Find player to remove
    const playerOutIndex = players.findIndex(p => p.playerId === validatedPlayerOutId);
    if (playerOutIndex === -1) {
      return res.status(400).json({ error: 'Player to remove not found in squad' });
    }
    
    const playerOut = players[playerOutIndex];
    
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
    const sellingPrice = getSellingPrice(playerOut.purchasePrice, playerOut.currentPrice);
    
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
    const isWildcardActive = squad.active_chip === 'wildcard';
    const isFreeHitActive = squad.active_chip === 'free_hit';
    const isFreeTransfer = squad.transfers_made_this_week < squad.free_transfers;
    
    let pointsCost = 0;
    if (!isWildcardActive && !isFreeHitActive && !isFreeTransfer) {
      pointsCost = 4;
    }
    
    // Update players array
    const updatedPlayers = [...players];
    updatedPlayers[playerOutIndex] = {
      playerId: validatedPlayerInId,
      position: playerOut.position,
      purchasePrice: playerInData.now_cost,
      currentPrice: playerInData.now_cost,
      isCaptain: playerOut.isCaptain,
      isViceCaptain: playerOut.isViceCaptain,
      multiplier: playerOut.multiplier
    };
    
    const newSquadValue = updatedPlayers.reduce((sum, p) => sum + p.currentPrice, 0) + newBank;
    
    const updatedSquad = await Squad.updateByUserId(validatedUserId, {
      players: updatedPlayers,
      bank: newBank,
      squadValue: newSquadValue,
      transfersMadeThisWeek: squad.transfers_made_this_week + 1,
      pointsDeducted: squad.points_deducted + pointsCost,
    });
    
    // Record transfer in history
    const transfer = await Transfer.create({
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
      chipActive: squad.active_chip
    });
    
    res.json({
      message: 'Transfer completed successfully',
      transfer,
      squad: {
        players: updatedSquad.players,
        bank: updatedSquad.bank,
        squadValue: updatedSquad.squad_value,
        transfersMadeThisWeek: updatedSquad.transfers_made_this_week,
        freeTransfers: updatedSquad.free_transfers,
        pointsDeducted: updatedSquad.points_deducted
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
    
    const validatedUserId = validateId(userId);
    
    const options = {};
    if (gameweek) options.gameweek = validateGameweek(gameweek);
    if (limit) options.limit = parseInt(limit);
    
    const transfers = await Transfer.findByUserId(validatedUserId, options);
    
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
        ...transfer,
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
    
    const validatedUserId = validateId(userId);
    const validatedGameweek = validateGameweek(gameweek);
    
    const transfers = await Transfer.findByUserIdAndGameweek(validatedUserId, validatedGameweek);
    
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
