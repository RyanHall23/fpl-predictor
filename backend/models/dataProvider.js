const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { validateEntryId, validateGameweek, validatePlayerId, validateLeagueId } = require('../utils/validation');

// ---------------------------------------------------------------------------
// Simple in-memory TTL cache to reduce repeated FPL API requests.
// Keys are URL strings; values are { data, expiresAt }.
// ---------------------------------------------------------------------------
const cache = new Map();
const MAX_CACHE_SIZE = 1000;

/** Rate-limited prune: only scan for expired entries at most once per minute. */
let _lastPrune = 0;
const PRUNE_INTERVAL_MS = 60_000;

const pruneExpiredEntries = (now = Date.now()) => {
  if (now - _lastPrune < PRUNE_INTERVAL_MS) return;
  _lastPrune = now;
  for (const [key, value] of cache.entries()) {
    if (value.expiresAt <= now) cache.delete(key);
  }
};

const enforceCacheSize = () => {
  while (cache.size > MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
};

/**
 * In-flight request deduplication.
 * Maps URL → Promise so concurrent cache misses on the same URL all await
 * the same underlying request instead of each firing a separate fetch.
 */
const _inFlight = new Map();

/**
 * Fetch a URL with exponential-backoff retry.
 *
 * Retries on:
 *   - HTTP 429 Too Many Requests  (FPL rate limit)
 *   - HTTP 5xx Server errors      (transient FPL outage)
 *   - Network/timeout errors      (ECONNRESET, ETIMEDOUT, etc.)
 *
 * Respects the `Retry-After` header when present (FPL sends this on 429).
 *
 * @param {string} url
 * @param {number} ttlMs
 */
const MAX_RETRIES   = 4;
const BASE_DELAY_MS = 500; // doubles each attempt: 500 → 1000 → 2000 → 4000

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fetchWithRetry = async (url, attempt = 1) => {
  try {
    const response = await axios.get(url, {
      timeout: 15_000, // 15-second socket timeout per request
      headers: { 'User-Agent': 'fpl-predictor/1.0' },
    });
    return response;
  } catch (err) {
    const status = err.response?.status;
    const isRateLimit    = status === 429;
    const isServerError  = status >= 500;
    const isNetworkError = !status; // ECONNRESET, ETIMEDOUT, etc.

    if ((isRateLimit || isServerError || isNetworkError) && attempt <= MAX_RETRIES) {
      // Honour Retry-After header if present (value is seconds)
      const retryAfterSec = parseInt(err.response?.headers?.['retry-after'] ?? '0', 10);
      const backoff = retryAfterSec > 0
        ? retryAfterSec * 1000
        : BASE_DELAY_MS * Math.pow(2, attempt - 1);

      console.warn(
        `[dataProvider] ${status ?? 'Network error'} on ${url} — retry ${attempt}/${MAX_RETRIES} in ${backoff}ms`,
      );
      await sleep(backoff);
      return fetchWithRetry(url, attempt + 1);
    }

    throw err;
  }
};

/**
 * Fetch a URL with in-memory TTL caching, request deduplication, and automatic retry.
 *
 * Concurrent callers hitting the same URL while a fetch is in-flight all
 * await the same Promise rather than each firing a separate request.
 */
const cachedGet = async (url, ttlMs) => {
  const now = Date.now();
  const hit = cache.get(url);
  if (hit) {
    if (now < hit.expiresAt) {
      // LRU: re-insert to mark as recently used
      cache.delete(url);
      cache.set(url, hit);
      return hit.data;
    }
    cache.delete(url);
  }

  pruneExpiredEntries(now);

  // Return in-flight promise for this URL if one already exists
  if (_inFlight.has(url)) {
    return _inFlight.get(url);
  }

  const fetchPromise = fetchWithRetry(url).then((response) => {
    cache.set(url, { data: response.data, expiresAt: Date.now() + ttlMs });
    enforceCacheSize();
    _inFlight.delete(url);
    return response.data;
  }).catch((err) => {
    _inFlight.delete(url);
    throw err;
  });

  _inFlight.set(url, fetchPromise);
  return fetchPromise;
};

// ---------------------------------------------------------------------------
// Adaptive TTL constants.
//
// Bootstrap and fixtures data changes very infrequently — only during/after
// a gameweek deadline.  Using a long TTL outside deadline windows avoids
// hammering the FPL API on every cold start while keeping data fresh when
// it actually matters.
//
// Three zones detected from wall-clock time (UTC, EPL season typically
// Fri–Tue for GW deadlines):
//   LIVE      — active scoring window (short TTLs)
//   DEADLINE  — within 2 h of a typical FPL deadline (short TTLs)
//   QUIET     — rest of the week (long TTLs)
// ---------------------------------------------------------------------------

const _ttlBootstrap = () => {
  const h = new Date().getUTCHours();
  const d = new Date().getUTCDay(); // 0=Sun … 6=Sat
  // Typical EPL GW deadlines are Sat 11:30 and Tue 18:30 UTC.
  // Use short TTL on Sat 09:30–13:30 and Tue 16:30–20:30 windows.
  const nearDeadline =
    (d === 6 && h >= 9  && h <= 13) || // Saturday
    (d === 2 && h >= 16 && h <= 20);   // Tuesday
  // Live scoring windows: Sat/Sun/Mon afternoons and Tuesday evenings
  const liveWindow =
    (d === 6 && h >= 14) || // Sat afternoon/evening
    (d === 0)              || // Sunday all day
    (d === 1)              || // Monday all day
    (d === 2 && h <= 23);    // Tuesday
  if (nearDeadline) return 2 * 60 * 1000;   // 2 min near deadline
  if (liveWindow)   return 5 * 60 * 1000;   // 5 min during live GW
  return 30 * 60 * 1000;                    // 30 min quiet period
};

// TTL_BOOTSTRAP is intentionally NOT a constant — call _ttlBootstrap() at the
// point of each fetch so the adaptive window is re-evaluated on every request.
const TTL_PROFILE    = 2 * 60 * 1000;     // 2 min  – entry/history/leagues
const TTL_PICKS      = 60 * 1000;         // 1 min  – picks can change during active GW
const TTL_LIVE       = 30 * 1000;         // 30 sec – live scores change often
const TTL_FIXTURES   = 10 * 60 * 1000;   // 10 min – fixture list rarely changes
const TTL_LEAGUE     = 2 * 60 * 1000;    // 2 min
const TTL_TRANSFERS  = 2 * 60 * 1000;    // 2 min

// ---------------------------------------------------------------------------
// Data source configuration
// ---------------------------------------------------------------------------
//
// Three modes, set via environment variables:
//
//   USE_FPL_API=true  (default)
//     All data fetched live from fantasy.premierleague.com.
//     Use in local development when you have direct internet access.
//
//   USE_FPL_API=false
//     All data loaded from mockData/ JSON files.
//     Use in unit tests / CI.
//
//   CACHE_STATIC=true  (recommended for Vercel)
//     Static, shared season data (bootstrap-static, fixtures, completed-GW
//     live scores) is loaded from committed seasonData/ JSON files — no API
//     call needed, no storage cost, no rate-limit risk.
//     User-specific endpoints (entry, picks, history, transfers, leagues,
//     element-summary) still call the FPL API because they're personal.
//
//     Populate seasonData/ by running the GitHub Actions workflow
//     `.github/workflows/fetch-season-data.yml` (runs automatically daily).
//
// ---------------------------------------------------------------------------

const USE_FPL_API    = (process.env.USE_FPL_API    ?? 'true') === 'true';
const CACHE_STATIC   = (process.env.CACHE_STATIC   ?? 'false') === 'true';

// Whitelist of allowed FPL API endpoints
const FPL_API_BASE = 'https://fantasy.premierleague.com/api';

// Legacy mock data directory (test / CI use)
const MOCK_DATA_DIR   = path.join(__dirname, '..', 'mockData');

// Committed season-data directory (Vercel / CACHE_STATIC use)
const SEASON_DATA_DIR = path.join(__dirname, '..', 'seasonData');

/**
 * Load a JSON file from a data directory.
 * @param {string} dir      - Absolute path to directory
 * @param {string} filename - Filename inside that directory
 * @returns {Promise<any>}
 */
const loadJsonFile = async (dir, filename) => {
  const filePath = path.join(dir, filename);
  const fileContent = await fs.readFile(filePath, 'utf8');
  return JSON.parse(fileContent);
};

/**
 * Load data from the legacy mockData directory (test mode).
 */
const loadMockData = async (filename) => {
  try {
    return await loadJsonFile(MOCK_DATA_DIR, filename);
  } catch (error) {
    console.error(`Error loading mock data from ${filename}:`, error.message);
    throw new Error(`Failed to load mock data: ${filename}`);
  }
};

/**
 * Load static season data from the committed seasonData directory.
 * Falls back to the FPL API if the file is missing (e.g. first deploy before
 * the Actions workflow has run).
 *
 * @param {string} filename    - Filename inside seasonData/
 * @param {string} fallbackUrl - FPL API URL to use as fallback
 * @param {number} ttlMs       - TTL for the API fallback cache entry
 * @returns {Promise<any>}
 */
const loadStaticOrFetch = async (filename, fallbackUrl, ttlMs) => {
  try {
    const data = await loadJsonFile(SEASON_DATA_DIR, filename);
    return data;
  } catch (_) {
    // File not yet populated — fall back to live API
    console.warn(`[SeasonData] ${filename} not found, fetching from FPL API as fallback.`);
    return await cachedGet(fallbackUrl, ttlMs);
  }
};

/**
 * Fetch bootstrap-static data (players, teams, events)
 * @returns {Promise<any>} - Bootstrap static data
 */
const fetchBootstrapStatic = async () => {
  if (!USE_FPL_API) {
    return await loadMockData('bootstrap-static.json');
  }
  if (CACHE_STATIC) {
    return await loadStaticOrFetch(
      'bootstrap-static.json',
      `${FPL_API_BASE}/bootstrap-static/`,
      _ttlBootstrap(),
    );
  }
  return await cachedGet(`${FPL_API_BASE}/bootstrap-static/`, _ttlBootstrap());
};

/**
 * Fetch player picks for a specific entry and event
 * @param {number|string} entryId - FPL entry/team ID
 * @param {number|string} eventId - Gameweek ID
 * @returns {Promise<any>} - Player picks data
 */
const fetchPlayerPicks = async (entryId, eventId) => {
  // Validate inputs to prevent SSRF
  const validatedEntryId = validateEntryId(entryId);
  const validatedEventId = validateGameweek(eventId);
  
  if (USE_FPL_API) {
    const url = `${FPL_API_BASE}/entry/${validatedEntryId}/event/${validatedEventId}/picks/`;
    return await cachedGet(url, TTL_PICKS);
  } else {
    console.log(`[Mock Mode] Fetching player picks for entry ${validatedEntryId} event ${validatedEventId} from local data`);
    return await loadMockData('player-picks.json');
  }
};

/**
 * Fetch element summary (player history and fixtures)
 * @param {number|string} playerId - Player element ID
 * @returns {Promise<any>} - Element summary data
 */
const fetchElementSummary = async (playerId) => {
  // Validate input to prevent SSRF
  const validatedPlayerId = validatePlayerId(playerId);
  
  if (USE_FPL_API) {
    const url = `${FPL_API_BASE}/element-summary/${validatedPlayerId}/`;
    return await cachedGet(url, TTL_PROFILE);
  } else {
    console.log(`[Mock Mode] Fetching element summary for player ${validatedPlayerId} from local data`);
    return await loadMockData('element-summary.json');
  }
};

/**
 * Fetch all fixtures
 * @returns {Promise<any>} - Fixtures data
 */
const fetchFixtures = async () => {
  if (!USE_FPL_API) {
    return await loadMockData('fixtures.json');
  }
  if (CACHE_STATIC) {
    return await loadStaticOrFetch(
      'fixtures.json',
      `${FPL_API_BASE}/fixtures/`,
      TTL_FIXTURES,
    );
  }
  return await cachedGet(`${FPL_API_BASE}/fixtures/`, TTL_FIXTURES);
};

/**
 * Fetch fixtures for a specific gameweek event
 * @param {number|string} eventId - Gameweek ID
 * @returns {Promise<Array>} - Fixtures for the given event
 */
const fetchEventFixtures = async (eventId) => {
  const validatedEventId = validateGameweek(eventId);
  const allFixtures = await fetchFixtures();
  // In all modes we derive GW fixtures from the full list; avoids a second
  // API call and keeps CACHE_STATIC consistent.
  return allFixtures.filter((f) => f.event === validatedEventId);
};

/**
 * Fetch live gameweek data.
 *
 * In CACHE_STATIC mode, completed-GW live scores are stored as individual
 * files: seasonData/live/gw-{n}.json  (written by the GitHub Actions workflow).
 * The current (active) gameweek is still fetched live from the API so scores
 * update in real time during a gameweek.
 *
 * @param {number|string} eventId - Gameweek ID
 * @returns {Promise<any>} - Live gameweek data
 */
const fetchLiveGameweek = async (eventId) => {
  const validatedEventId = validateGameweek(eventId);

  if (!USE_FPL_API) {
    return await loadMockData('live-gameweek.json');
  }

  if (CACHE_STATIC) {
    // Try the committed per-GW file first
    try {
      return await loadJsonFile(
        path.join(SEASON_DATA_DIR, 'live'),
        `gw-${validatedEventId}.json`,
      );
    } catch (_) {
      // Not yet committed (current / future GW) — fetch live
    }
  }

  return await cachedGet(`${FPL_API_BASE}/event/${validatedEventId}/live/`, TTL_LIVE);
};

/**
 * Fetch a per-GW player + team snapshot.
 *
 * These snapshots are written by the GitHub Actions workflow to
 * seasonData/players/gw-{n}.json and capture the state of all player and
 * team data at the time of the daily fetch for that gameweek.
 *
 * Returns an object shaped as { elements: [...], teams: [...] }, or null if
 * no snapshot exists for the requested GW (backtest engine falls back to
 * current bootstrap data when null is returned).
 *
 * @param {number|string} gwId - Gameweek ID
 * @returns {Promise<{elements: Array, teams: Array}|null>}
 */
const fetchGwPlayerSnapshot = async (gwId) => {
  const validatedGwId = validateGameweek(gwId);

  if (!USE_FPL_API) {
    // In mock mode just return null — backtest uses current bootstrap
    return null;
  }

  if (CACHE_STATIC) {
    try {
      return await loadJsonFile(
        path.join(SEASON_DATA_DIR, 'players'),
        `gw-${validatedGwId}.json`,
      );
    } catch (_) {
      return null; // Snapshot not yet committed for this GW
    }
  }

  // Live mode: no historical snapshots available via the FPL API
  return null;
};

/**
 * Fetch pre-computed predictions for a GW written by the GitHub Actions
 * workflow.  Returns an object shaped as:
 *
 *   { gwId, computedAt, playerCount, players: { [playerId]: { predicted_points, ... } } }
 *
 * Returns null when no stored prediction exists (caller falls back to live
 * computation).
 *
 * @param {number|string} gwId - Gameweek ID
 * @returns {Promise<Object|null>}
 */
const fetchStoredPredictions = async (gwId) => {
  const validatedGwId = validateGameweek(gwId);

  if (!CACHE_STATIC) return null; // Only used in static-cache mode

  try {
    return await loadJsonFile(
      path.join(SEASON_DATA_DIR, 'predictions'),
      `gw-${validatedGwId}.json`,
    );
  } catch (_) {
    return null; // Not yet generated for this GW
  }
};

/**
 * Fetch entry (user profile) data
 * @param {number|string} entryId - FPL entry/team ID
 * @returns {Promise<any>} - Entry data
 */
const fetchEntry = async (entryId) => {
  // Validate input to prevent SSRF
  const validatedEntryId = validateEntryId(entryId);
  
  if (USE_FPL_API) {
    const url = `${FPL_API_BASE}/entry/${validatedEntryId}/`;
    return await cachedGet(url, TTL_PROFILE);
  } else {
    console.log(`[Mock Mode] Fetching entry ${validatedEntryId} from local data`);
    return await loadMockData('entry.json');
  }
};

/**
 * Fetch entry history data
 * @param {number|string} entryId - FPL entry/team ID
 * @returns {Promise<any>} - History data
 */
const fetchHistory = async (entryId) => {
  // Validate input to prevent SSRF
  const validatedEntryId = validateEntryId(entryId);
  
  if (USE_FPL_API) {
    const url = `${FPL_API_BASE}/entry/${validatedEntryId}/history/`;
    return await cachedGet(url, TTL_PROFILE);
  } else {
    console.log(`[Mock Mode] Fetching history for entry ${validatedEntryId} from local data`);
    return await loadMockData('history.json');
  }
};

/**
 * Fetch all transfers made by an entry (team)
 * @param {number|string} entryId - FPL entry/team ID
 * @returns {Promise<Array>} - Array of transfer objects { element_in, element_in_cost, element_out, element_out_cost, entry, event, time }
 */
const fetchEntryTransfers = async (entryId) => {
  const validatedEntryId = validateEntryId(entryId);
  if (USE_FPL_API) {
    const url = `${FPL_API_BASE}/entry/${validatedEntryId}/transfers/`;
    return await cachedGet(url, TTL_TRANSFERS);
  } else {
    console.log(`[Mock Mode] Fetching transfers for entry ${validatedEntryId} from local data`);
    return [];
  }
};

/**
 * Fetch classic league standings
 * @param {number|string} leagueId - FPL classic league ID
 * @param {number} [page=1] - Page number for standings pagination
 * @returns {Promise<any>} - League standings data
 */
const fetchLeagueStandings = async (leagueId, page = 1) => {
  // Validate input to prevent SSRF
  const validatedLeagueId = validateLeagueId(leagueId);

  if (USE_FPL_API) {
    const url = `${FPL_API_BASE}/leagues-classic/${validatedLeagueId}/standings/?page_standings=${page}`;
    return await cachedGet(url, TTL_LEAGUE);
  } else {
    console.log(`[Mock Mode] Fetching league standings for league ${validatedLeagueId} from local data`);
    return await loadMockData('league-standings.json');
  }
};

module.exports = {
  fetchBootstrapStatic,
  fetchPlayerPicks,
  fetchElementSummary,
  fetchFixtures,
  fetchEventFixtures,
  fetchLiveGameweek,
  fetchGwPlayerSnapshot,
  fetchStoredPredictions,
  fetchEntry,
  fetchHistory,
  fetchEntryTransfers,
  fetchLeagueStandings,
  USE_FPL_API,
  CACHE_STATIC,
};
