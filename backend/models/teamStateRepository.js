'use strict';

/**
 * teamStateRepository
 *
 * File-based JSON persistence for the FPL Predictor's Team feature.
 * Stores the generated/managed squad state and historical recommendation records
 * in backend/seasonData/ so they survive server restarts without a database.
 */

const fs   = require('fs');
const path = require('path');

const DATA_DIR    = path.join(__dirname, '..', 'seasonData');
const STATE_FILE  = path.join(DATA_DIR, 'predictor-team-state.json');
const HISTORY_FILE = path.join(DATA_DIR, 'predictor-team-history.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Load persisted predictor team state.
 * @returns {Object|null} State object or null if not yet saved.
 */
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (err) {
    console.warn('[teamStateRepository] Could not load state:', err.message);
  }
  return null;
}

/**
 * Persist predictor team state to disk.
 * @param {Object} state - State object to persist.
 */
function saveState(state) {
  try {
    ensureDataDir();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.warn('[teamStateRepository] Could not save state:', err.message);
  }
}

/**
 * Load persisted recommendation history.
 * @returns {{ recommendations: Array }} History object (empty array if not yet saved).
 */
function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
      return { recommendations: Array.isArray(data.recommendations) ? data.recommendations : [] };
    }
  } catch (err) {
    console.warn('[teamStateRepository] Could not load history:', err.message);
  }
  return { recommendations: [] };
}

/**
 * Persist recommendation history to disk.
 * @param {{ recommendations: Array }} history - History object to persist.
 */
function saveHistory(history) {
  try {
    ensureDataDir();
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (err) {
    console.warn('[teamStateRepository] Could not save history:', err.message);
  }
}

module.exports = { loadState, saveState, loadHistory, saveHistory };
