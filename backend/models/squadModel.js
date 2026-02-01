const mongoose = require('mongoose');

/**
 * Player in Squad Schema
 * Stores individual player with purchase and current price information
 */
const squadPlayerSchema = new mongoose.Schema({
  playerId: {
    type: Number,
    required: true
  },
  position: {
    type: Number, // 1-15 (1-11 starting, 12-15 bench)
    required: true
  },
  purchasePrice: {
    type: Number, // Price in £0.1m units (e.g., 75 = £7.5m)
    required: true
  },
  currentPrice: {
    type: Number, // Current price in £0.1m units
    required: true
  },
  isCaptain: {
    type: Boolean,
    default: false
  },
  isViceCaptain: {
    type: Boolean,
    default: false
  },
  multiplier: {
    type: Number,
    default: 1 // 1 = normal, 2 = captain, 3 = triple captain
  }
});

/**
 * Squad Schema
 * Stores a user's current FPL squad with all pricing information
 */
const squadSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true // Each user has one current squad
  },
  gameweek: {
    type: Number,
    required: true // Current gameweek this squad is for
  },
  players: [squadPlayerSchema],
  bank: {
    type: Number, // Money in bank in £0.1m units
    default: 0
  },
  squadValue: {
    type: Number, // Total squad value (sum of current prices + bank)
    required: true
  },
  freeTransfers: {
    type: Number,
    default: 1,
    min: 0,
    max: 2 // Maximum 2 free transfers can be banked
  },
  transfersMadeThisWeek: {
    type: Number,
    default: 0
  },
  pointsDeducted: {
    type: Number, // Points deducted this week from transfers
    default: 0
  },
  activeChip: {
    type: String,
    enum: ['bench_boost', 'free_hit', 'triple_captain', 'wildcard', null],
    default: null
  }
}, {
  timestamps: true
});

// Method to calculate selling price for a player
squadPlayerSchema.methods.getSellingPrice = function() {
  if (this.currentPrice <= this.purchasePrice) {
    return this.currentPrice;
  }
  
  // Keep half of the profit, rounded down to nearest 0.1m
  const profit = this.currentPrice - this.purchasePrice;
  const profitToKeep = Math.floor(profit / 2);
  return this.purchasePrice + profitToKeep;
};

// Method to calculate total selling value of squad
squadSchema.methods.getTotalSellingValue = function() {
  const playersValue = this.players.reduce((total, player) => {
    const playerDoc = new mongoose.Document(player, squadPlayerSchema);
    return total + playerDoc.getSellingPrice();
  }, 0);
  return playersValue + this.bank;
};

// Method to get transfer cost for this gameweek
squadSchema.methods.getTransferCost = function() {
  if (this.activeChip === 'wildcard' || this.activeChip === 'free_hit') {
    return 0; // No cost when these chips are active
  }
  
  const excessTransfers = Math.max(0, this.transfersMadeThisWeek - this.freeTransfers);
  return excessTransfers * 4; // 4 points per extra transfer
};

module.exports = mongoose.model('Squad', squadSchema);
