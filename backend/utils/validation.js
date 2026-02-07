const mongoose = require('mongoose');

/**
 * Validate and sanitize MongoDB ObjectId
 * Prevents NoSQL injection attacks
 * @param {string} id - User-provided ID
 * @returns {string} - Validated ObjectId
 * @throws {Error} - If ID is invalid
 */
function validateObjectId(id) {
  if (!id || typeof id !== 'string') {
    throw new Error('Invalid ID: must be a non-empty string');
  }
  
  // Check if it's a valid MongoDB ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error('Invalid ID: not a valid MongoDB ObjectId');
  }
  
  // Return the validated ID as a string (Mongoose will convert it)
  return id.trim();
}

/**
 * Validate FPL entry ID (team ID)
 * Must be a positive integer
 * @param {string|number} entryId - FPL entry/team ID
 * @returns {number} - Validated entry ID
 * @throws {Error} - If entry ID is invalid
 */
function validateEntryId(entryId) {
  const id = parseInt(entryId, 10);
  
  if (!Number.isInteger(id) || id <= 0 || id > 10000000) {
    throw new Error('Invalid entry ID: must be a positive integer');
  }
  
  return id;
}

/**
 * Validate gameweek number
 * Must be between 1 and 38
 * @param {string|number} gameweek - Gameweek number
 * @returns {number} - Validated gameweek
 * @throws {Error} - If gameweek is invalid
 */
function validateGameweek(gameweek) {
  const gw = parseInt(gameweek, 10);
  
  if (!Number.isInteger(gw) || gw < 1 || gw > 38) {
    throw new Error('Invalid gameweek: must be between 1 and 38');
  }
  
  return gw;
}

/**
 * Validate FPL player/element ID
 * Must be a positive integer
 * @param {string|number} playerId - Player element ID
 * @returns {number} - Validated player ID
 * @throws {Error} - If player ID is invalid
 */
function validatePlayerId(playerId) {
  const id = parseInt(playerId, 10);
  
  if (!Number.isInteger(id) || id <= 0 || id > 1000) {
    throw new Error('Invalid player ID: must be a positive integer');
  }
  
  return id;
}

/**
 * Validate chip name
 * Must be one of the allowed chip types
 * @param {string} chipName - Chip name
 * @returns {string} - Validated chip name
 * @throws {Error} - If chip name is invalid
 */
function validateChipName(chipName) {
  const allowedChips = ['bench_boost', 'free_hit', 'triple_captain', 'wildcard'];
  
  if (!chipName || typeof chipName !== 'string') {
    throw new Error('Invalid chip name: must be a non-empty string');
  }
  
  const normalized = chipName.toLowerCase().trim();
  
  if (!allowedChips.includes(normalized)) {
    throw new Error(`Invalid chip name: must be one of ${allowedChips.join(', ')}`);
  }
  
  return normalized;
}

/**
 * Validate FPL API URL to prevent SSRF attacks
 * Only allows official FPL API endpoints
 * @param {string} url - URL to validate
 * @returns {string} - Validated URL
 * @throws {Error} - If URL is invalid or not allowed
 */
function validateFplApiUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid URL: must be a non-empty string');
  }
  
  const allowedDomain = 'fantasy.premierleague.com';
  const allowedProtocol = 'https:';
  
  try {
    const urlObj = new URL(url);
    
    // Check protocol
    if (urlObj.protocol !== allowedProtocol) {
      throw new Error(`Invalid URL protocol: only ${allowedProtocol} is allowed`);
    }
    
    // Check domain
    if (urlObj.hostname !== allowedDomain) {
      throw new Error(`Invalid URL domain: only ${allowedDomain} is allowed`);
    }
    
    // Check path starts with /api/
    if (!urlObj.pathname.startsWith('/api/')) {
      throw new Error('Invalid URL path: must start with /api/');
    }
    
    return url;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Invalid URL format');
    }
    throw error;
  }
}

module.exports = {
  validateObjectId,
  validateEntryId,
  validateGameweek,
  validatePlayerId,
  validateChipName,
  validateFplApiUrl,
};
