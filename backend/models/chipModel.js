const { query } = require('../db');

/**
 * Default chip state for a new user.
 */
const defaultChipData = () => ({
  benchBoost1:     { available: true, usedInGameweek: null, availableFrom: 1,  availableUntil: 19 },
  benchBoost2:     { available: true, usedInGameweek: null, availableFrom: 20, availableUntil: 38 },
  tripleCaptain1:  { available: true, usedInGameweek: null, availableFrom: 1,  availableUntil: 19 },
  tripleCaptain2:  { available: true, usedInGameweek: null, availableFrom: 20, availableUntil: 38 },
  freeHit1:        { available: true, usedInGameweek: null, availableFrom: 2,  availableUntil: 19 },
  freeHit2:        { available: true, usedInGameweek: null, availableFrom: 20, availableUntil: 38 },
  wildcard1:       { available: true, usedInGameweek: null, availableFrom: 2,  availableUntil: 19 },
  wildcard2:       { available: true, usedInGameweek: null, availableFrom: 20, availableUntil: 38 },
});

/**
 * Get all available chip names for a specific gameweek.
 * @param {Object} data - Chip data object
 * @param {number} gameweek
 * @param {number|null} lastUsedFreeHit
 * @returns {string[]}
 */
function getAvailableChips(data, gameweek, lastUsedFreeHit = null) {
  const available = [];
  const canUseFreeHit = !lastUsedFreeHit || (gameweek - lastUsedFreeHit) >= 2;

  const chipKeys = [
    ['benchBoost1',    'bench_boost_1'],
    ['benchBoost2',    'bench_boost_2'],
    ['tripleCaptain1', 'triple_captain_1'],
    ['tripleCaptain2', 'triple_captain_2'],
    ['freeHit1',       'free_hit_1'],
    ['freeHit2',       'free_hit_2'],
    ['wildcard1',      'wildcard_1'],
    ['wildcard2',      'wildcard_2'],
  ];

  for (const [key, name] of chipKeys) {
    const chip = data[key];
    if (!chip || !chip.available) continue;
    if (gameweek < chip.availableFrom || gameweek > chip.availableUntil) continue;
    if (name.startsWith('free_hit') && !canUseFreeHit) continue;
    available.push(name);
  }
  return available;
}

/**
 * Mark a chip as used for the given gameweek.
 * Mutates the data object in place.
 * @param {Object} data
 * @param {string} chipName
 * @param {number} gameweek
 * @returns {boolean}
 */
function useChip(data, chipName, gameweek) {
  const chipMapping = {
    'bench_boost_1':    'benchBoost1',
    'bench_boost_2':    'benchBoost2',
    'triple_captain_1': 'tripleCaptain1',
    'triple_captain_2': 'tripleCaptain2',
    'free_hit_1':       'freeHit1',
    'free_hit_2':       'freeHit2',
    'wildcard_1':       'wildcard1',
    'wildcard_2':       'wildcard2',
  };

  const field = chipMapping[chipName];
  if (!field || !data[field]) return false;
  if (!data[field].available) return false;
  if (gameweek < data[field].availableFrom || gameweek > data[field].availableUntil) return false;

  data[field].available = false;
  data[field].usedInGameweek = gameweek;
  return true;
}

const Chip = {
  async findByUserId(userId) {
    const result = await query('SELECT * FROM chips WHERE user_id = $1', [userId]);
    if (!result.rows[0]) return null;
    return { userId: result.rows[0].user_id, data: result.rows[0].data };
  },

  async create(userId) {
    const result = await query(
      'INSERT INTO chips (user_id, data) VALUES ($1, $2) RETURNING *',
      [userId, JSON.stringify(defaultChipData())]
    );
    return { userId: result.rows[0].user_id, data: result.rows[0].data };
  },

  async updateByUserId(userId, data) {
    const result = await query(
      'UPDATE chips SET data = $2, updated_at = NOW() WHERE user_id = $1 RETURNING *',
      [userId, JSON.stringify(data)]
    );
    return result.rows[0] ? { userId: result.rows[0].user_id, data: result.rows[0].data } : null;
  },
};

module.exports = { Chip, defaultChipData, getAvailableChips, useChip };
