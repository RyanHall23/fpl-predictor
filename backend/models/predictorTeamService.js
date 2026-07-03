'use strict';

/**
 * Predictor Team Service
 *
 * Orchestrates the FPL Predictor's managed team lifecycle:
 *
 *   Pre-season  → Generate an optimal £100m squad using the prediction engine.
 *                 Persist it.  No FPL Team ID required.
 *
 *   Active season → Read APPLICATION_TEAM env var to load the real team from the
 *                   FPL API.  If unconfigured, continue showing the pre-season
 *                   squad but disable recommendations with a warning.
 *
 * The service never submits transfers or mutates any live FPL data.
 */

const fplModel             = require('./fplModel');
const dataProvider         = require('./dataProvider');
const teamStateRepository  = require('./teamStateRepository');
const teamDecisionEngine   = require('./teamDecisionEngine');

// FPL squad rules
const SQUAD_BUDGET         = 1000;   // £100.0m (FPL stores prices in tenths of £m)
const POSITION_QUOTAS      = { 1: 2, 2: 5, 3: 5, 4: 3 };
const MAX_PLAYERS_PER_CLUB = 3;

// ── Season phase detection ────────────────────────────────────────────────────

/**
 * Detect whether the season has started.
 *
 * @param {Array} events - events array from bootstrap-static
 * @returns {'pre-season' | 'active'}
 */
function detectSeasonPhase(events) {
  if (!Array.isArray(events) || events.length === 0) return 'active';
  return events.some(e => e.finished || e.is_current) ? 'active' : 'pre-season';
}

/**
 * Get the ID of the current (or most recently completed) gameweek.
 *
 * @param {Array} events
 * @returns {number}
 */
function getCurrentGameweek(events) {
  const current = events.find(e => e.is_current);
  if (current) return current.id;
  const finished = events.filter(e => e.finished);
  if (finished.length) return finished[finished.length - 1].id;
  // Pre-season: return the first event
  return events[0]?.id ?? 1;
}

/**
 * Read APPLICATION_TEAM environment variable.
 * Returns null if missing or non-numeric.
 *
 * @returns {string|null}
 */
function getApplicationTeamId() {
  const val = process.env.APPLICATION_TEAM;
  if (!val) return null;
  const trimmed = val.trim();
  return /^\d+$/.test(trimmed) ? trimmed : null;
}

// ── Budget-aware squad generation ─────────────────────────────────────────────

/**
 * Select the best 15 players within the £100m budget, enforcing position
 * quotas (2 GK, 5 DEF, 5 MID, 3 FWD) and the 3-per-club limit.
 *
 * Uses a greedy algorithm: fill each position's quota in turn, choosing
 * highest-EP available players that fit within budget and club constraints.
 *
 * @param {Object[]} players - All FPL players, enriched with ep_next
 * @returns {Object[]}       - 15 selected player objects
 */
function buildBudgetOptimizedSquad(players) {
  const getEp = (p) => {
    const v = parseFloat(p.ep_next ?? p.computed_ep_next ?? p.ep_this ?? 0);
    return Number.isFinite(v) ? v : 0;
  };

  const candidates = players
    .filter(p => p.element_type >= 1 && p.element_type <= 4 && p.now_cost > 0)
    .sort((a, b) => getEp(b) - getEp(a));

  const posCount   = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const clubCounts = {};
  let budgetLeft   = SQUAD_BUDGET;
  const squad      = [];

  for (const pos of [1, 2, 3, 4]) {
    const quota = POSITION_QUOTAS[pos];
    const posPlayers = candidates.filter(p => p.element_type === pos);

    for (const player of posPlayers) {
      if (posCount[pos] >= quota) break;
      const club = player.team;
      if ((clubCounts[club] || 0) >= MAX_PLAYERS_PER_CLUB) continue;
      if (player.now_cost > budgetLeft) continue;

      squad.push(player);
      posCount[pos]++;
      clubCounts[club] = (clubCounts[club] || 0) + 1;
      budgetLeft -= player.now_cost;
    }
  }

  return squad;
}

/**
 * Build a minimal player record for persistence (strips heavy prediction data).
 *
 * @param {Object} player
 * @returns {Object}
 */
function minimalPlayer(player) {
  return {
    id:           player.id,
    code:         player.code,
    web_name:     player.web_name,
    element_type: player.element_type,
    team:         player.team,
    teamShortName: player.teamShortName ?? null,
    now_cost:     player.now_cost,
    ep_next:      parseFloat(player.ep_next ?? 0) || 0,
    photo:        player.photo ?? null,
  };
}

// ── Pre-season squad generation ───────────────────────────────────────────────

/**
 * Return the persisted pre-season squad, generating a fresh one if none exists
 * or if `forceRegenerate` is true.
 *
 * @param {Object[]} players   - All FPL players from bootstrap-static
 * @param {Object[]} fixtures  - All fixtures
 * @param {Object[]} teams     - Teams from bootstrap-static
 * @param {number}   targetGW  - Gameweek to predict for (typically GW1)
 * @param {boolean}  [forceRegenerate=false]
 * @returns {Promise<Object>}  - Stored state object
 */
async function getOrGeneratePreSeasonSquad(players, fixtures, teams, targetGW, forceRegenerate = false) {
  const existing = teamStateRepository.loadPredictorTeam();
  if (!forceRegenerate && existing && existing.phase === 'pre-season' && Array.isArray(existing.squad) && existing.squad.length === 15) {
    return existing;
  }
  return regeneratePreSeasonSquad(players, fixtures, teams, targetGW);
}

/**
 * Force-regenerate the pre-season squad using the prediction engine.
 *
 * @param {Object[]} players
 * @param {Object[]} fixtures
 * @param {Object[]} teams
 * @param {number}   targetGW
 * @returns {Promise<Object>}
 */
async function regeneratePreSeasonSquad(players, fixtures, teams, targetGW) {
  console.log(`[predictorTeamService] Generating pre-season squad for GW${targetGW}…`);

  let enriched = fplModel.enrichPlayersWithOpponents(players, fixtures, teams, targetGW);
  enriched = await fplModel.applyPredictionsWithCache(enriched, fixtures, teams, targetGW, 'predictor-preseason');

  const squad = buildBudgetOptimizedSquad(enriched);
  if (!Array.isArray(squad) || squad.length !== 15) {
    throw new Error(`[predictorTeamService] Pre-season squad generation failed: expected 15 players, got ${squad?.length ?? 0}.`);
  }

  const totalCost          = squad.reduce((s, p) => s + p.now_cost, 0);
  const bank               = SQUAD_BUDGET - totalCost;
  const getEp              = (p) => parseFloat(p.ep_next ?? 0) || 0;
  const totalPredictedPts  = squad.reduce((s, p) => s + getEp(p), 0);

  // Determine the active / reserve split
  const lineup = teamDecisionEngine.recommendLineup(squad);
  const captainInfo = teamDecisionEngine.recommendCaptain(lineup.activePlayers);

  // Mark captain / vice-captain
  const markLineup = (arr) => arr.map(p => ({
    ...p,
    is_captain:      p.id === captainInfo.captain?.id,
    is_vice_captain: p.id === captainInfo.viceCaptain?.id,
    multiplier:      p.id === captainInfo.captain?.id ? 2 : 1,
  }));

  const activeMarked  = markLineup(lineup.activePlayers);
  const reserveMarked = lineup.reservePlayers.map(p => ({
    ...p,
    is_captain: false,
    is_vice_captain: p.id === captainInfo.viceCaptain?.id,
    multiplier: 1,
  }));

  const state = {
    phase:               'pre-season',
    generatedAt:         new Date().toISOString(),
    targetGW,
    squad:               squad.map(minimalPlayer),
    activePlayers:       activeMarked.map(minimalPlayer),
    reservePlayers:      reserveMarked.map(minimalPlayer),
    captainId:           captainInfo.captain?.id ?? null,
    viceCaptainId:       captainInfo.viceCaptain?.id ?? null,
    bank,
    totalCost,
    totalPredictedPoints: totalPredictedPts,
  };

  teamStateRepository.savePredictorTeam(state);
  console.log(`[predictorTeamService] Pre-season squad saved (cost: £${(totalCost / 10).toFixed(1)}m, bank: £${(bank / 10).toFixed(1)}m)`);

  return state;
}

// ── Active-season team loading ────────────────────────────────────────────────

/**
 * Fetch the live team state from the FPL API for the configured team ID.
 * Returns enriched player data with predictions applied.
 *
 * @param {string}   teamId
 * @param {Object[]} players   - All FPL players (from bootstrap-static)
 * @param {Object[]} fixtures
 * @param {Object[]} teams
 * @param {number}   currentGW
 * @param {number}   targetGW
 * @returns {Promise<Object>}
 */
async function loadActiveTeamState(teamId, players, fixtures, teams, currentGW, targetGW) {
  // Fetch picks, transfers, history, and entry data in parallel
  const [picksResult, transfersResult, historyResult, entryResult] = await Promise.allSettled([
    dataProvider.fetchPlayerPicks(teamId, currentGW),
    dataProvider.fetchEntryTransfers(teamId),
    dataProvider.fetchHistory(teamId),
    dataProvider.fetchEntry(teamId),
  ]);

  const picksData = picksResult.status === 'fulfilled' ? picksResult.value : { picks: [], entry_history: {} };
  const picks     = picksData.picks || [];
  const entryHistory = picksData.entry_history || {};

  // Build purchase-price map from transfer history for accurate selling prices
  let purchasePriceMap = {};
  if (transfersResult.status === 'fulfilled') {
    const transfers = transfersResult.value;
    const sorted = [...transfers].sort((a, b) => {
      if (a.event !== b.event) return a.event - b.event;
      return (a.time ?? '').localeCompare(b.time ?? '');
    });
    sorted.forEach(t => { purchasePriceMap[t.element_in] = t.element_in_cost; });
  }

  // Enrich player list with selling prices
  let enrichedPlayers = players.map(p => {
    const purchasePrice = purchasePriceMap[p.id] ?? (p.now_cost - (p.cost_change_start ?? 0));
    const sellingPrice  = p.now_cost >= purchasePrice
      ? purchasePrice + Math.floor((p.now_cost - purchasePrice) / 2)
      : p.now_cost;
    return { ...p, ep_next: parseFloat(p.ep_next) || 0, purchase_price: purchasePrice, selling_price: sellingPrice };
  });

  enrichedPlayers = fplModel.enrichPlayersWithOpponents(enrichedPlayers, fixtures, teams, targetGW);
  enrichedPlayers = await fplModel.applyPredictionsWithCache(enrichedPlayers, fixtures, teams, targetGW, 'predictor-active');

  // Build the player map for squad lookup
  const playerMap = {};
  enrichedPlayers.forEach(p => { playerMap[p.id] = p; });

  // Map picks to enriched player objects
  const squad = picks.map(pick => {
    const player = playerMap[pick.element];
    if (!player) return null;
    return {
      ...player,
      pick_position:   pick.position,
      is_captain:      !!pick.is_captain,
      is_vice_captain: !!pick.is_vice_captain,
      multiplier:      pick.multiplier ?? 1,
    };
  }).filter(Boolean);

  // Calculate free transfers from history
  let freeTransfers = 1;
  if (historyResult.status === 'fulfilled') {
    try {
      const gwHistory = (historyResult.value.current || []).sort((a, b) => a.event - b.event);
      let ft = 1;
      for (const gw of gwHistory) {
        if (gw.event >= targetGW) break;
        if (gw.event_chip === 'freehit')   { ft = Math.min(2, ft + 1); }
        else if (gw.event_chip === 'wildcard') { ft = 1; }
        else { ft = Math.min(2, Math.max(0, ft - (gw.event_transfers || 0)) + 1); }
      }
      freeTransfers = ft;
    } catch (_) { freeTransfers = 1; }
  }

  // Chips used (for chip recommendations)
  const usedChips = historyResult.status === 'fulfilled'
    ? (historyResult.value.chips || []).map(c => c.name)
    : [];

  // Entry summary
  const entry         = entryResult.status === 'fulfilled' ? entryResult.value : null;
  const overallPoints = historyResult.status === 'fulfilled'
    ? (historyResult.value.current || []).reduce((s, gw) => s + gw.points, 0)
    : null;
  const overallRank   = entry?.summary_overall_rank ?? null;

  // Active / reserve split
  const activePlayers  = squad.filter(p => p.pick_position <= 11).sort((a, b) => a.pick_position - b.pick_position);
  const reservePlayers = squad.filter(p => p.pick_position > 11).sort((a, b) => a.pick_position - b.pick_position);

  return {
    squad:           squad.map(minimalPlayer),
    activePlayers:   activePlayers.map(p => ({ ...minimalPlayer(p), is_captain: p.is_captain, is_vice_captain: p.is_vice_captain, multiplier: p.multiplier })),
    reservePlayers:  reservePlayers.map(p => ({ ...minimalPlayer(p), is_captain: p.is_captain, is_vice_captain: p.is_vice_captain, multiplier: p.multiplier })),
    captainId:       picks.find(p => p.is_captain)?.element ?? null,
    viceCaptainId:   picks.find(p => p.is_vice_captain)?.element ?? null,
    bank:            entryHistory.bank ?? null,
    totalCost:       entryHistory.value ?? null,
    freeTransfers,
    usedChips,
    overallPoints,
    overallRank,
    entryName:       entry ? `${entry.player_first_name ?? ''} ${entry.player_last_name ?? ''}`.trim() : null,
    // Keep enriched squad for recommendation engine
    enrichedSquad: squad,
    enrichedPlayers,
  };
}

// ── Main orchestration ────────────────────────────────────────────────────────

/**
 * Get the full predictor team status — the single entry point used by the
 * controller.
 *
 * Returns a status object that the frontend renders directly.
 *
 * @returns {Promise<Object>}
 */
async function getPredictorTeamStatus() {
  const [bootstrap, fixtures] = await Promise.all([
    fplModel.fetchBootstrapStatic(),
    fplModel.fetchFixtures(),
  ]);

  const events      = bootstrap.events;
  const teams       = bootstrap.teams;
  const phase       = detectSeasonPhase(events);
  const currentGW   = getCurrentGameweek(events);
  const targetGW    = phase === 'pre-season' ? 1 : Math.min(currentGW + 1, 38);
  const teamId      = getApplicationTeamId();

  const players = bootstrap.elements.map(p => ({
    ...p,
    ep_next: parseFloat(p.ep_next) || 0,
  }));

  if (phase === 'pre-season') {
    // Generate / return pre-season squad
    const state = await getOrGeneratePreSeasonSquad(players, fixtures, teams, targetGW);
    return {
      phase:                    'pre-season',
      applicationTeamConfigured: false,
      applicationTeamId:        null,
      currentGameweek:          currentGW,
      targetGameweek:           targetGW,
      warning:                  null,
      ...state,
    };
  }

  // Active season
  if (!teamId) {
    // No team configured — return saved pre-season/last-known state with warning
    const saved = teamStateRepository.loadPredictorTeam();
    return {
      phase:                    'active',
      applicationTeamConfigured: false,
      applicationTeamId:        null,
      currentGameweek:          currentGW,
      targetGameweek:           targetGW,
      warning:                  'APPLICATION_TEAM is not configured. FPL Predictor\'s Team has generated its initial squad but cannot continue autonomous tracking until APPLICATION_TEAM is set.',
      ...(saved || {}),
      squad:          saved?.squad          ?? [],
      activePlayers:  saved?.activePlayers  ?? [],
      reservePlayers: saved?.reservePlayers ?? [],
    };
  }

  // Load real team from FPL API
  const liveState = await loadActiveTeamState(teamId, players, fixtures, teams, currentGW, targetGW);

  // Persist the updated state
  const persistedState = {
    phase:     'active',
    teamId,
    updatedAt: new Date().toISOString(),
    targetGW,
    squad:          liveState.squad,
    activePlayers:  liveState.activePlayers,
    reservePlayers: liveState.reservePlayers,
    captainId:      liveState.captainId,
    viceCaptainId:  liveState.viceCaptainId,
    bank:           liveState.bank,
    totalCost:      liveState.totalCost,
    freeTransfers:  liveState.freeTransfers,
    usedChips:      liveState.usedChips,
    overallPoints:  liveState.overallPoints,
    overallRank:    liveState.overallRank,
    entryName:      liveState.entryName,
  };
  teamStateRepository.savePredictorTeam(persistedState);

  return {
    applicationTeamConfigured: true,
    applicationTeamId:         teamId,
    currentGameweek:           currentGW,
    targetGameweek:            targetGW,
    warning:                   null,
    // Expose enriched data for the recommendations endpoint (stripped from persistence)
    _enrichedSquad:    liveState.enrichedSquad,
    _enrichedPlayers:  liveState.enrichedPlayers,
    ...persistedState,
  };
}

/**
 * Generate recommendations for the predictor's current team.
 *
 * @returns {Promise<Object>}
 */
async function getPredictorTeamRecommendations() {
  const status = await getPredictorTeamStatus();
  const currentGW = status.currentGameweek;
  const targetGW  = status.targetGameweek;

  // Recommendations are unavailable without a configured team in an active season
  if (status.phase === 'active' && !status.applicationTeamConfigured) {
    return {
      gameweek:        targetGW,
      unavailable:     true,
      unavailableReason: status.warning,
      transfers:       [],
      captain:         null,
      viceCaptain:     null,
      lineup:          null,
      chipSuggestion:  null,
    };
  }

  let allPlayers = status._enrichedPlayers;
  if (!Array.isArray(allPlayers) || allPlayers.length === 0) {
    const [bootstrap, fixtures] = await Promise.all([
      fplModel.fetchBootstrapStatic(),
      fplModel.fetchFixtures(),
    ]);
    const allPlayersRaw = bootstrap.elements.map(p => ({ ...p, ep_next: parseFloat(p.ep_next) || 0 }));
    allPlayers = fplModel.enrichPlayersWithOpponents(allPlayersRaw, fixtures, bootstrap.teams, targetGW);
    allPlayers = await fplModel.applyPredictionsWithCache(allPlayers, fixtures, bootstrap.teams, targetGW, 'predictor-recs');
  }
  // Resolve squad as enriched player objects
  const playerMap = {};
  allPlayers.forEach(p => { playerMap[p.id] = p; });

  const savedState = teamStateRepository.loadPredictorTeam();
  const squadIds   = (savedState?.squad ?? []).map(p => p.id);
  const enrichedSquad = squadIds.map(id => playerMap[id]).filter(Boolean);

  if (enrichedSquad.length === 0) {
    return { gameweek: targetGW, unavailable: true, unavailableReason: 'No squad data available.', transfers: [], captain: null, viceCaptain: null, lineup: null, chipSuggestion: null };
  }

  // Lineup recommendation
  const lineup      = teamDecisionEngine.recommendLineup(enrichedSquad);
  const captainInfo = teamDecisionEngine.recommendCaptain(lineup.activePlayers);

  // Transfer recommendations
  const bank          = savedState.bank ?? 0;
  const freeTransfers = savedState.freeTransfers ?? 1;
  const usedChips     = savedState.usedChips ?? [];
  const transfers     = teamDecisionEngine.recommendTransfers(enrichedSquad, allPlayers, bank, freeTransfers);

  // Chip recommendation
  const chipSuggestion = teamDecisionEngine.recommendChip(lineup.activePlayers, lineup.reservePlayers, usedChips);

  const predictedPoints = lineup.activePlayers.reduce((s, p) => {
    const ep = parseFloat(p.ep_next ?? 0) || 0;
    const mult = p.id === captainInfo.captain?.id ? 2 : 1;
    return s + ep * mult;
  }, 0);

  // Persist the recommendation to history
  teamStateRepository.upsertDecisionHistory({
    gameweek:         targetGW,
    computedAt:       new Date().toISOString(),
    suggestedTransfers: transfers.map(t => ({ out: t.playerOut.web_name, in: t.playerIn.web_name, epGain: t.epGain })),
    suggestedCaptain: captainInfo.captain?.web_name ?? null,
    predictedPoints:  Math.round(predictedPoints * 10) / 10,
    actualPoints:     null,
    accuracy:         null,
  });

  return {
    gameweek:      targetGW,
    currentGameweek: currentGW,
    unavailable:   false,
    unavailableReason: null,
    transfers,
    captain:       captainInfo.captain   ? { player: minimalPlayer(captainInfo.captain),    reason: captainInfo.captainReason } : null,
    viceCaptain:   captainInfo.viceCaptain ? { player: minimalPlayer(captainInfo.viceCaptain), reason: captainInfo.vcReason } : null,
    lineup: {
      activePlayers:  lineup.activePlayers.map(p => ({ ...minimalPlayer(p), ep_next: parseFloat(p.ep_next ?? 0) || 0 })),
      reservePlayers: lineup.reservePlayers.map(p => ({ ...minimalPlayer(p), ep_next: parseFloat(p.ep_next ?? 0) || 0 })),
    },
    chipSuggestion,
    predictedPoints: Math.round(predictedPoints * 10) / 10,
  };
}

module.exports = {
  detectSeasonPhase,
  getCurrentGameweek,
  getApplicationTeamId,
  buildBudgetOptimizedSquad,
  getOrGeneratePreSeasonSquad,
  regeneratePreSeasonSquad,
  getPredictorTeamStatus,
  getPredictorTeamRecommendations,
};
