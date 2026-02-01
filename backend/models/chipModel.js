const mongoose = require('mongoose');

/**
 * Chip Schema
 * Tracks chip availability and usage for each user
 */
const chipSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  // Bench Boost chips
  benchBoost1: {
    available: { type: Boolean, default: true },
    usedInGameweek: { type: Number, default: null },
    availableFrom: { type: Number, default: 1 },
    availableUntil: { type: Number, default: 19 }
  },
  benchBoost2: {
    available: { type: Boolean, default: true },
    usedInGameweek: { type: Number, default: null },
    availableFrom: { type: Number, default: 20 },
    availableUntil: { type: Number, default: 38 }
  },
  // Triple Captain chips
  tripleCaptain1: {
    available: { type: Boolean, default: true },
    usedInGameweek: { type: Number, default: null },
    availableFrom: { type: Number, default: 1 },
    availableUntil: { type: Number, default: 19 }
  },
  tripleCaptain2: {
    available: { type: Boolean, default: true },
    usedInGameweek: { type: Number, default: null },
    availableFrom: { type: Number, default: 20 },
    availableUntil: { type: Number, default: 38 }
  },
  // Free Hit chips
  freeHit1: {
    available: { type: Boolean, default: true },
    usedInGameweek: { type: Number, default: null },
    availableFrom: { type: Number, default: 2 }, // After first gameweek
    availableUntil: { type: Number, default: 19 }
  },
  freeHit2: {
    available: { type: Boolean, default: true },
    usedInGameweek: { type: Number, default: null },
    availableFrom: { type: Number, default: 20 },
    availableUntil: { type: Number, default: 38 }
  },
  // Wildcard chips
  wildcard1: {
    available: { type: Boolean, default: true },
    usedInGameweek: { type: Number, default: null },
    availableFrom: { type: Number, default: 2 }, // After first gameweek
    availableUntil: { type: Number, default: 19 }
  },
  wildcard2: {
    available: { type: Boolean, default: true },
    usedInGameweek: { type: Number, default: null },
    availableFrom: { type: Number, default: 20 },
    availableUntil: { type: Number, default: 38 }
  }
}, {
  timestamps: true
});

/**
 * Get all available chips for a specific gameweek
 * @param {Number} gameweek - The gameweek to check
 * @param {Number} lastUsedFreeHit - Last gameweek where Free Hit was used (for consecutive check)
 * @returns {Array} - Array of available chip names
 */
chipSchema.methods.getAvailableChips = function(gameweek, lastUsedFreeHit = null) {
  const available = [];
  
  // Check Bench Boost
  if (this.benchBoost1.available && gameweek >= this.benchBoost1.availableFrom && gameweek <= this.benchBoost1.availableUntil) {
    available.push('bench_boost_1');
  }
  if (this.benchBoost2.available && gameweek >= this.benchBoost2.availableFrom && gameweek <= this.benchBoost2.availableUntil) {
    available.push('bench_boost_2');
  }
  
  // Check Triple Captain
  if (this.tripleCaptain1.available && gameweek >= this.tripleCaptain1.availableFrom && gameweek <= this.tripleCaptain1.availableUntil) {
    available.push('triple_captain_1');
  }
  if (this.tripleCaptain2.available && gameweek >= this.tripleCaptain2.availableFrom && gameweek <= this.tripleCaptain2.availableUntil) {
    available.push('triple_captain_2');
  }
  
  // Check Free Hit (cannot be used in consecutive gameweeks)
  const canUseFreeHit = !lastUsedFreeHit || (gameweek - lastUsedFreeHit) >= 2;
  if (canUseFreeHit) {
    if (this.freeHit1.available && gameweek >= this.freeHit1.availableFrom && gameweek <= this.freeHit1.availableUntil) {
      available.push('free_hit_1');
    }
    if (this.freeHit2.available && gameweek >= this.freeHit2.availableFrom && gameweek <= this.freeHit2.availableUntil) {
      available.push('free_hit_2');
    }
  }
  
  // Check Wildcard
  if (this.wildcard1.available && gameweek >= this.wildcard1.availableFrom && gameweek <= this.wildcard1.availableUntil) {
    available.push('wildcard_1');
  }
  if (this.wildcard2.available && gameweek >= this.wildcard2.availableFrom && gameweek <= this.wildcard2.availableUntil) {
    available.push('wildcard_2');
  }
  
  return available;
};

/**
 * Use a chip for a specific gameweek
 * @param {String} chipName - Name of the chip (e.g., 'bench_boost_1')
 * @param {Number} gameweek - The gameweek it's being used in
 * @returns {Boolean} - Success or failure
 */
chipSchema.methods.useChip = function(chipName, gameweek) {
  const chipMapping = {
    'bench_boost_1': 'benchBoost1',
    'bench_boost_2': 'benchBoost2',
    'triple_captain_1': 'tripleCaptain1',
    'triple_captain_2': 'tripleCaptain2',
    'free_hit_1': 'freeHit1',
    'free_hit_2': 'freeHit2',
    'wildcard_1': 'wildcard1',
    'wildcard_2': 'wildcard2'
  };
  
  const chipField = chipMapping[chipName];
  if (!chipField || !this[chipField]) {
    return false;
  }
  
  if (!this[chipField].available) {
    return false;
  }
  
  // Check if gameweek is in valid range
  if (gameweek < this[chipField].availableFrom || gameweek > this[chipField].availableUntil) {
    return false;
  }
  
  this[chipField].available = false;
  this[chipField].usedInGameweek = gameweek;
  return true;
};

module.exports = mongoose.model('Chip', chipSchema);
