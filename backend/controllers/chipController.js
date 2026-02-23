const { Squad } = require('../models/squadModel');
const SquadHistory = require('../models/squadHistoryModel');
const { Chip, getAvailableChips, useChip } = require('../models/chipModel');
const { validateId, validateGameweek, validateChipName } = require('../utils/validation');

/**
 * Get available chips for a user in a specific gameweek
 */
const getAvailableChipsHandler = async (req, res) => {
  try {
    const { userId } = req.params;
    const { gameweek } = req.query;
    
    if (!gameweek) {
      return res.status(400).json({ error: 'Gameweek parameter required' });
    }
    
    const validatedUserId = validateId(userId);
    const validatedGameweek = validateGameweek(gameweek);
    
    const chips = await Chip.findByUserId(validatedUserId);
    if (!chips) {
      return res.status(404).json({ error: 'Chip data not found for user' });
    }
    
    // Get last Free Hit usage to check consecutive gameweek rule
    const squad = await Squad.findByUserId(validatedUserId);
    let lastFreeHitGameweek = null;
    
    if (squad && squad.active_chip === 'free_hit') {
      lastFreeHitGameweek = squad.gameweek;
    } else {
      const lastFreeHitHistory = await SquadHistory.findLastWithActiveChip({
        userId: validatedUserId,
        activeChip: 'free_hit'
      });
      
      if (lastFreeHitHistory) {
        lastFreeHitGameweek = lastFreeHitHistory.gameweek;
      }
    }
    
    const availableChipNames = getAvailableChips(chips.data, validatedGameweek, lastFreeHitGameweek);
    
    // Format response with chip details
    const chipDetails = availableChipNames.map(chipName => {
      const chipParts = chipName.split('_');
      const chipType = chipParts.slice(0, -1).join('_');
      const chipNumber = chipParts[chipParts.length - 1];
      
      let description, effect;
      switch (chipType) {
        case 'bench_boost':
          description = 'Bench Boost';
          effect = 'Points scored by your bench players are included in your total';
          break;
        case 'triple_captain':
          description = 'Triple Captain';
          effect = 'Your captain points are tripled instead of doubled';
          break;
        case 'free_hit':
          description = 'Free Hit';
          effect = 'Make unlimited free transfers for a single Gameweek. Squad returns to previous state next gameweek';
          break;
        case 'wildcard':
          description = 'Wildcard';
          effect = 'All transfers in the Gameweek are free of charge';
          break;
        default:
          description = chipName;
          effect = '';
      }
      
      return {
        id: chipName,
        type: chipType,
        number: chipNumber,
        description,
        effect
      };
    });
    
    res.json({
      userId: validatedUserId,
      gameweek: validatedGameweek,
      availableChips: chipDetails,
      allChips: chips.data
    });
  } catch (error) {
    console.error('Error getting available chips:', error);
    res.status(500).json({ error: 'Error getting available chips', details: error.message });
  }
};

/**
 * Activate a chip for the current gameweek
 */
const activateChip = async (req, res) => {
  try {
    const { userId, chipName, gameweek } = req.body;
    
    if (!userId || !chipName || !gameweek) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, chipName, gameweek' 
      });
    }
    
    const validatedUserId = validateId(userId);
    const validatedChipName = validateChipName(chipName);
    const validatedGameweek = validateGameweek(gameweek);
    
    // Get chip data
    const chips = await Chip.findByUserId(validatedUserId);
    if (!chips) {
      return res.status(404).json({ error: 'Chip data not found for user' });
    }
    
    // Get squad
    const squad = await Squad.findByUserId(validatedUserId);
    if (!squad) {
      return res.status(404).json({ error: 'Squad not found' });
    }
    
    if (squad.gameweek !== validatedGameweek) {
      return res.status(400).json({ 
        error: `Squad is on gameweek ${squad.gameweek}, but chip activation requested for gameweek ${validatedGameweek}` 
      });
    }
    
    // Check if chip is already active
    if (squad.active_chip) {
      return res.status(400).json({ 
        error: `Chip already active this gameweek: ${squad.active_chip}` 
      });
    }
    
    // Validate consecutive Free Hit rule
    if (validatedChipName.startsWith('free_hit')) {
      const lastFreeHitHistory = await SquadHistory.findLastWithActiveChip({
        userId: validatedUserId,
        activeChip: 'free_hit'
      });
      
      if (lastFreeHitHistory && (validatedGameweek - lastFreeHitHistory.gameweek) < 2) {
        return res.status(400).json({ 
          error: 'Free Hit cannot be used in consecutive gameweeks',
          lastUsed: lastFreeHitHistory.gameweek
        });
      }
    }
    
    // For Free Hit, save current squad state before activation
    if (validatedChipName.startsWith('free_hit')) {
      await SquadHistory.create({
        userId: validatedUserId,
        gameweek: validatedGameweek,
        snapshotType: 'pre_chip',
        players: squad.players,
        bank: squad.bank,
        squadValue: squad.squad_value,
        freeTransfers: squad.free_transfers,
        transfersMadeThisWeek: squad.transfers_made_this_week,
        pointsDeducted: squad.points_deducted,
        activeChip: null
      });
    }
    
    // Use the chip (mutates chips.data in place)
    const chipData = { ...chips.data };
    const chipUsed = useChip(chipData, validatedChipName, validatedGameweek);
    if (!chipUsed) {
      return res.status(400).json({ 
        error: 'Chip not available or invalid for this gameweek' 
      });
    }
    
    await Chip.updateByUserId(validatedUserId, chipData);
    
    // Update squad with active chip
    const chipType = validatedChipName.split('_').slice(0, -1).join('_');
    const squadUpdates = { activeChip: chipType };
    
    // For Wildcard and Free Hit, reset transfer counters
    if (chipType === 'wildcard' || chipType === 'free_hit') {
      squadUpdates.transfersMadeThisWeek = 0;
      squadUpdates.pointsDeducted = 0;
    }
    
    // For Triple Captain, update captain multiplier
    let players = squad.players;
    if (chipType === 'triple_captain') {
      players = players.map(p => p.isCaptain ? { ...p, multiplier: 3 } : p);
      squadUpdates.players = players;
    }
    
    await Squad.updateByUserId(validatedUserId, squadUpdates);
    
    res.json({
      message: `Chip ${chipType} activated successfully`,
      chip: validatedChipName,
      activeChip: chipType,
      squad: {
        gameweek: squad.gameweek,
        activeChip: chipType,
        transfersMadeThisWeek: squadUpdates.transfersMadeThisWeek ?? squad.transfers_made_this_week,
        pointsDeducted: squadUpdates.pointsDeducted ?? squad.points_deducted
      }
    });
  } catch (error) {
    console.error('Error activating chip:', error);
    res.status(500).json({ error: 'Error activating chip', details: error.message });
  }
};

/**
 * Cancel an active chip (only allowed before gameweek deadline for certain chips)
 */
const cancelChip = async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'Missing required field: userId' });
    }
    
    const validatedUserId = validateId(userId);
    
    const squad = await Squad.findByUserId(validatedUserId);
    if (!squad) {
      return res.status(404).json({ error: 'Squad not found' });
    }
    
    if (!squad.active_chip) {
      return res.status(400).json({ error: 'No active chip to cancel' });
    }
    
    // Free Hit and Wildcard cannot be cancelled once confirmed
    if (squad.active_chip === 'free_hit' || squad.active_chip === 'wildcard') {
      return res.status(400).json({ 
        error: `${squad.active_chip} cannot be cancelled once activated` 
      });
    }
    
    // For Triple Captain, revert multiplier
    let players = squad.players;
    if (squad.active_chip === 'triple_captain') {
      players = players.map(p => p.isCaptain ? { ...p, multiplier: 2 } : p);
    }
    
    // Find which chip was used this gameweek and restore it
    const chips = await Chip.findByUserId(validatedUserId);
    if (chips) {
      const chipData = { ...chips.data };
      for (const key of Object.keys(chipData)) {
        if (chipData[key] && chipData[key].usedInGameweek === squad.gameweek) {
          chipData[key] = { ...chipData[key], available: true, usedInGameweek: null };
          break;
        }
      }
      await Chip.updateByUserId(validatedUserId, chipData);
    }
    
    const cancelledChip = squad.active_chip;
    await Squad.updateByUserId(validatedUserId, { activeChip: null, players });
    
    res.json({
      message: `Chip ${cancelledChip} cancelled successfully`,
      squad: {
        gameweek: squad.gameweek,
        activeChip: null
      }
    });
  } catch (error) {
    console.error('Error cancelling chip:', error);
    res.status(500).json({ error: 'Error cancelling chip', details: error.message });
  }
};

module.exports = {
  getAvailableChips: getAvailableChipsHandler,
  activateChip,
  cancelChip
};
