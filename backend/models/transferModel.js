const mongoose = require('mongoose');

/**
 * Transfer Schema
 * Tracks all player transfers made by users
 */
const transferSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  gameweek: {
    type: Number,
    required: true
  },
  playerIn: {
    playerId: {
      type: Number,
      required: true
    },
    price: {
      type: Number, // Purchase price in £0.1m units
      required: true
    }
  },
  playerOut: {
    playerId: {
      type: Number,
      required: true
    },
    purchasePrice: {
      type: Number, // Original purchase price
      required: true
    },
    sellingPrice: {
      type: Number, // Actual selling price (with profit rules)
      required: true
    }
  },
  isFree: {
    type: Boolean,
    default: false // Whether this was a free transfer
  },
  pointsCost: {
    type: Number,
    default: 0 // Points deducted for this transfer (0 or 4)
  },
  chipActive: {
    type: String,
    enum: ['wildcard', 'free_hit', null],
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient queries
transferSchema.index({ userId: 1, gameweek: 1 });
transferSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Transfer', transferSchema);
