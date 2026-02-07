const Squad = require('../models/squadModel');
const SquadHistory = require('../models/squadHistoryModel');
const Chip = require('../models/chipModel');
const { validateObjectId, validateGameweek, validateChipName } = require('../utils/validation');

/**
 * Get available chips for a user in a specific gameweek
 */
const getAvailableChips = async (req, res) => {
  try {
    const { userId } = req.params;
    const { gameweek } = req.query;
    
    if (!gameweek) {
      return res.status(400).json({ error: 'Gameweek parameter required' });
    }
    
    // Validate to prevent NoSQL injection
    const validatedUserId = validateObjectId(userId);
    const validatedGameweek = validateGameweek(gameweek);
    
    const chips = await Chip.findOne({ userId: validatedUserId });
    if (!chips) {
      return res.status(404).json({ error: 'Chip data not found for user' });
    }
    
    // Get last Free Hit usage to check consecutive gameweek rule
    const squad = await Squad.findOne({ userId: validatedUserId });
    let lastFreeHitGameweek = null;
    
    if (squad && squad.activeChip === 'free_hit') {
      lastFreeHitGameweek = squad.gameweek;
    } else {
      // Check history for last Free Hit usage
      const lastFreeHitHistory = await SquadHistory.findOne({
        userId: validatedUserId,
        activeChip: 'free_hit'
      }).sort({ gameweek: -1 });
      
      if (lastFreeHitHistory) {
        lastFreeHitGameweek = lastFreeHitHistory.gameweek;
      }
    }
    
    const availableChips = chips.getAvailableChips(validatedGameweek, lastFreeHitGameweek);
    
    // Format response with chip details
    const chipDetails = availableChips.map(chipName => {
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
      allChips: {
        benchBoost1: chips.benchBoost1,
        benchBoost2: chips.benchBoost2,
        tripleCaptain1: chips.tripleCaptain1,
        tripleCaptain2: chips.tripleCaptain2,
        freeHit1: chips.freeHit1,
        freeHit2: chips.freeHit2,
        wildcard1: chips.wildcard1,
        wildcard2: chips.wildcard2
      }
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
    
    // Validate to prevent NoSQL injection
    const validatedUserId = validateObjectId(userId);
    const validatedChipName = validateChipName(chipName);
    const validatedGameweek = validateGameweek(gameweek);
    
    // Get chip data
    const chips = await Chip.findOne({ userId: validatedUserId });
    if (!chips) {
      return res.status(404).json({ error: 'Chip data not found for user' });
    }
    
    // Get squad
    const squad = await Squad.findOne({ userId: validatedUserId });
    if (!squad) {
      return res.status(404).json({ error: 'Squad not found' });
    }
    
    if (squad.gameweek !== validatedGameweek) {
      return res.status(400).json({ 
        error: `Squad is on gameweek ${squad.gameweek}, but chip activation requested for gameweek ${validatedGameweek}` 
      });
    }
    
    // Check if chip is already active
    if (squad.activeChip) {
      return res.status(400).json({ 
        error: `Chip already active this gameweek: ${squad.activeChip}` 
      });
    }
    
    // Validate consecutive Free Hit rule
    if (validatedChipName.startsWith('free_hit')) {
      const lastFreeHitHistory = await SquadHistory.findOne({
        userId: validatedUserId,
        activeChip: 'free_hit'
      }).sort({ gameweek: -1 });
      
      if (lastFreeHitHistory && (validatedGameweek - lastFreeHitHistory.gameweek) < 2) {
        return res.status(400).json({ 
          error: 'Free Hit cannot be used in consecutive gameweeks',
          lastUsed: lastFreeHitHistory.gameweek
        });
      }
    }
    
    // For Free Hit, save current squad state before activation
    if (validatedChipName.startsWith('free_hit')) {
      const preChipHistory = new SquadHistory({
        userId: validatedUserId,
        gameweek: validatedGameweek,
        snapshotType: 'pre_chip',
        players: squad.players,
        bank: squad.bank,
        squadValue: squad.squadValue,
        freeTransfers: squad.freeTransfers,
        transfersMadeThisWeek: squad.transfersMadeThisWeek,
        pointsDeducted: squad.pointsDeducted,
        activeChip: null
      });
      await preChipHistory.save();
    }
    
    // Use the chip
    const chipUsed = chips.useChip(validatedChipName, validatedGameweek);
    if (!chipUsed) {
      return res.status(400).json({ 
        error: 'Chip not available or invalid for this gameweek' 
      });
    }
    
    await chips.save();
    
    // Update squad with active chip
    const chipType = validatedChipName.split('_').slice(0, -1).join('_');
    squad.activeChip = chipType;
    
    // For Wildcard and Free Hit, reset transfer counters
    if (chipType === 'wildcard' || chipType === 'free_hit') {
      squad.transfersMadeThisWeek = 0;
      squad.pointsDeducted = 0;
    }
    
    // For Triple Captain, update captain multiplier
    if (chipType === 'triple_captain') {
      const captainIndex = squad.players.findIndex(p => p.isCaptain);
      if (captainIndex !== -1) {
        squad.players[captainIndex].multiplier = 3;
      }
    }
    
    await squad.save();
    
    res.json({
      message: `Chip ${chipType} activated successfully`,
      chip: validatedChipName,
      activeChip: squad.activeChip,
      squad: {
        gameweek: squad.gameweek,
        activeChip: squad.activeChip,
        transfersMadeThisWeek: squad.transfersMadeThisWeek,
        pointsDeducted: squad.pointsDeducted
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
    
    // Validate to prevent NoSQL injection
    const validatedUserId = validateObjectId(userId);
    
    const squad = await Squad.findOne({ userId: validatedUserId });
    if (!squad) {
      return res.status(404).json({ error: 'Squad not found' });
    }
    
    if (!squad.activeChip) {
      return res.status(400).json({ error: 'No active chip to cancel' });
    }
    
    // Free Hit and Wildcard cannot be cancelled once confirmed
    if (squad.activeChip === 'free_hit' || squad.activeChip === 'wildcard') {
      return res.status(400).json({ 
        error: `${squad.activeChip} cannot be cancelled once activated` 
      });
    }
    
    // For Triple Captain, revert multiplier
    if (squad.activeChip === 'triple_captain') {
      const captainIndex = squad.players.findIndex(p => p.isCaptain);
      if (captainIndex !== -1) {
        squad.players[captainIndex].multiplier = 2; // Revert to normal captain
      }
    }
    
    // Find which chip was used and restore availability
    const chips = await Chip.findOne({ userId: validatedUserId });
    if (chips) {
      // Find the chip that was used this gameweek and restore it
      for (const [key, value] of Object.entries(chips.toObject())) {
        if (typeof value === 'object' && value.usedInGameweek === squad.gameweek) {
          chips[key].available = true;
          chips[key].usedInGameweek = null;
          break;
        }
      }
      await chips.save();
    }
    
    const cancelledChip = squad.activeChip;
    squad.activeChip = null;
    await squad.save();
    
    res.json({
      message: `Chip ${cancelledChip} cancelled successfully`,
      squad: {
        gameweek: squad.gameweek,
        activeChip: squad.activeChip
      }
    });
  } catch (error) {
    console.error('Error cancelling chip:', error);
    res.status(500).json({ error: 'Error cancelling chip', details: error.message });
  }
};

module.exports = {
  getAvailableChips,
  activateChip,
  cancelChip
};
