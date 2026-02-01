const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Environment flag to control data source
// USE_FPL_API: 'true' (default) - Use real FPL API
// USE_FPL_API: 'false' - Use local mock data for testing
const USE_FPL_API = (process.env.USE_FPL_API ?? 'true') === 'true';

// Mock data is in backend/mockData, one level up from models directory
const MOCK_DATA_DIR = path.join(__dirname, '..', 'mockData');

/**
 * Load mock data from a JSON file
 * @param {string} filename - Name of the mock data file
 * @returns {Promise<any>} - Parsed JSON data
 */
const loadMockData = async (filename) => {
  try {
    const filePath = path.join(MOCK_DATA_DIR, filename);
    const fileContent = await fs.readFile(filePath, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`Error loading mock data from ${filename}:`, error.message);
    throw new Error(`Failed to load mock data: ${filename}`);
  }
};

/**
 * Fetch bootstrap-static data (players, teams, events)
 * @returns {Promise<any>} - Bootstrap static data
 */
const fetchBootstrapStatic = async () => {
  if (USE_FPL_API) {
    const response = await axios.get('https://fantasy.premierleague.com/api/bootstrap-static/');
    return response.data;
  } else {
    console.log('[Mock Mode] Fetching bootstrap-static from local data');
    return await loadMockData('bootstrap-static.json');
  }
};

/**
 * Fetch player picks for a specific entry and event
 * @param {number|string} entryId - FPL entry/team ID
 * @param {number|string} eventId - Gameweek ID
 * @returns {Promise<any>} - Player picks data
 */
const fetchPlayerPicks = async (entryId, eventId) => {
  if (USE_FPL_API) {
    const response = await axios.get(`https://fantasy.premierleague.com/api/entry/${entryId}/event/${eventId}/picks/`);
    return response.data;
  } else {
    console.log(`[Mock Mode] Fetching player picks for entry ${entryId} event ${eventId} from local data`);
    return await loadMockData('player-picks.json');
  }
};

/**
 * Fetch element summary (player history and fixtures)
 * @param {number|string} playerId - Player element ID
 * @returns {Promise<any>} - Element summary data
 */
const fetchElementSummary = async (playerId) => {
  if (USE_FPL_API) {
    const response = await axios.get(`https://fantasy.premierleague.com/api/element-summary/${playerId}/`);
    return response.data;
  } else {
    console.log(`[Mock Mode] Fetching element summary for player ${playerId} from local data`);
    return await loadMockData('element-summary.json');
  }
};

/**
 * Fetch all fixtures
 * @returns {Promise<any>} - Fixtures data
 */
const fetchFixtures = async () => {
  if (USE_FPL_API) {
    const response = await axios.get('https://fantasy.premierleague.com/api/fixtures/');
    return response.data;
  } else {
    console.log('[Mock Mode] Fetching fixtures from local data');
    return await loadMockData('fixtures.json');
  }
};

/**
 * Fetch live gameweek data
 * @param {number|string} eventId - Gameweek ID
 * @returns {Promise<any>} - Live gameweek data
 */
const fetchLiveGameweek = async (eventId) => {
  if (USE_FPL_API) {
    const response = await axios.get(`https://fantasy.premierleague.com/api/event/${eventId}/live/`);
    return response.data;
  } else {
    console.log(`[Mock Mode] Fetching live gameweek ${eventId} from local data`);
    return await loadMockData('live-gameweek.json');
  }
};

/**
 * Fetch entry (user profile) data
 * @param {number|string} entryId - FPL entry/team ID
 * @returns {Promise<any>} - Entry data
 */
const fetchEntry = async (entryId) => {
  if (USE_FPL_API) {
    const response = await axios.get(`https://fantasy.premierleague.com/api/entry/${entryId}/`);
    return response.data;
  } else {
    console.log(`[Mock Mode] Fetching entry ${entryId} from local data`);
    return await loadMockData('entry.json');
  }
};

/**
 * Fetch entry history data
 * @param {number|string} entryId - FPL entry/team ID
 * @returns {Promise<any>} - History data
 */
const fetchHistory = async (entryId) => {
  if (USE_FPL_API) {
    const response = await axios.get(`https://fantasy.premierleague.com/api/entry/${entryId}/history/`);
    return response.data;
  } else {
    console.log(`[Mock Mode] Fetching history for entry ${entryId} from local data`);
    return await loadMockData('history.json');
  }
};

module.exports = {
  fetchBootstrapStatic,
  fetchPlayerPicks,
  fetchElementSummary,
  fetchFixtures,
  fetchLiveGameweek,
  fetchEntry,
  fetchHistory,
  USE_FPL_API
};
