const mongoose = require('mongoose');

/**
 * Squad History Schema
 * Stores a snapshot of a user's squad for a specific gameweek
 * Used for historical tracking and rollback (e.g., Free Hit chip)
 */
const squadHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  gameweek: {
    type: Number,
    required: true
  },
  snapshotType: {
    type: String,
    enum: ['regular', 'pre_chip'],
    default: 'regular'
  },
  players: [{
    playerId: Number,
    position: Number,
    purchasePrice: Number,
    currentPrice: Number,
    isCaptain: Boolean,
    isViceCaptain: Boolean,
    multiplier: Number
  }],
  bank: {
    type: Number,
    default: 0
  },
  squadValue: {
    type: Number,
    required: true
  },
  freeTransfers: {
    type: Number,
    default: 1
  },
  transfersMadeThisWeek: {
    type: Number,
    default: 0
  },
  pointsDeducted: {
    type: Number,
    default: 0
  },
  activeChip: {
    type: String,
    enum: ['bench_boost', 'free_hit', 'triple_captain', 'wildcard', null],
    default: null
  },
  pointsScored: {
    type: Number,
    default: 0
  },
  overallRank: {
    type: Number,
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient queries (removed unique constraint to allow pre-chip snapshots)
squadHistorySchema.index({ userId: 1, gameweek: 1, snapshotType: 1 });

module.exports = mongoose.model('SquadHistory', squadHistorySchema);
