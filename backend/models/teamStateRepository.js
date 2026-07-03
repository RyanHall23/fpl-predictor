'use strict';

/**
 * Team State Repository
 *
 * File-based persistence for the FPL Predictor's managed team state.
 * Stores the pre-season generated squad, current team state, and
 * historical recommendations.
 *
 * Follows the same pattern as calibrationStore.js — using JSON files in a
 * configurable data directory that falls back to /tmp on Vercel.
 */

const fs   = require('fs');
const path = require('path');

const IS_VERCEL  = Boolean(process.env.VERCEL || process.env.NOW_REGION);
const DATA_DIR   = process.env.PREDICTOR_DATA_DIR || (IS_VERCEL
  ? '/tmp'
  : path.join(__dirname, '..', '..', 'data'));

const TEAM_FILE    = path.join(DATA_DIR, 'predictor-team.json');
const HISTORY_FILE = path.join(DATA_DIR, 'predictor-history.json');

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.warn(`[teamStateRepository] Failed to read ${filePath}:`, err.message);
    return null;
  }
}

function writeJson(filePath, data) {
  ensureDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ── Predictor Team State ──────────────────────────────────────────────────────

/**
 * Load the persisted predictor team state.
 * Returns null if no state has been saved yet.
 *
 * @returns {Object|null}
 */
function loadPredictorTeam() {
  return readJson(TEAM_FILE);
}

/**
 * Save the predictor team state to disk.
 *
 * @param {Object} state
 */
function savePredictorTeam(state) {
  writeJson(TEAM_FILE, { ...state, savedAt: new Date().toISOString() });
}

// ── Decision History ──────────────────────────────────────────────────────────

/**
 * Load the full recommendation history array.
 *
 * @returns {Array}
 */
function loadDecisionHistory() {
  return readJson(HISTORY_FILE) || [];
}

/**
 * Upsert a decision history entry for a given gameweek.
 * If an entry for that gameweek already exists it is merged (later fields win).
 *
 * @param {Object} entry  - Must contain at least { gameweek: number }
 */
function upsertDecisionHistory(entry) {
  const history = loadDecisionHistory();
  const idx = history.findIndex(h => h.gameweek === entry.gameweek);
  if (idx >= 0) {
    history[idx] = { ...history[idx], ...entry };
  } else {
    history.push(entry);
  }
  history.sort((a, b) => a.gameweek - b.gameweek);
  writeJson(HISTORY_FILE, history);
}

module.exports = {
  loadPredictorTeam,
  savePredictorTeam,
  loadDecisionHistory,
  upsertDecisionHistory,
};
