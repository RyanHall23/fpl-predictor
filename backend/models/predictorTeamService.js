'use strict';

/**
 * predictorTeamService
 *
 * Business logic for the FPL Predictor's Team feature.
 *
 * Responsibilities:
 *   - Detect season phase (pre-GW1 vs active season)
 *   - Generate a budget-constrained pre-season squad (£100m)
 *   - Load the managed team from FPL when APPLICATION_TEAM is configured
 *   - Persist and restore team state via teamStateRepository
 *
 * Does NOT make UI or HTTP decisions — those belong to the controller.
 */

const fplModel            = require('./fplModel');
const dataProvider        = require('./dataProvider');
const teamStateRepository = require('./teamStateRepository');

// FPL squad rules
const TOTAL_BUDGET = 1000;   // £100.0m in 0.1m units
const MAX_CLUB     = 3;
const REQUIRED_COUNTS = { 1: 2, 2: 5, 3: 5, 4: 3 }; // GKP, DEF, MID, FWD

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ep(player) {
  return parseFloat(player.ep_next) || 0;
}

/**
 * Read the configured managed-team ID from the environment.
 * Returns null when APPLICATION_TEAM is not set.
 */
function getApplicationTeamId() {
  const val = process.env.APPLICATION_TEAM;
  return val && /^\d+$/.test(val.trim()) ? val.trim() : null;
}

/**
 * Determine whether the season has begun.
 *
 * Pre-season: GW1 deadline has not yet passed.
 * Active:     GW1 deadline has passed (or any event is current/finished).
 */
function detectSeasonPhase(events) {
  if (!Array.isArray(events) || events.length === 0) return 'pre_season';

  // If any event is marked current or finished, the season is underway.
  if (events.some(e => e.is_current || e.finished)) return 'active';

  // If GW1 deadline has passed, treat as active.
  const gw1 = events.find(e => e.id === 1);
  if (gw1?.deadline_time && Date.now() >= new Date(gw1.deadline_time).getTime()) {
    return 'active';
  }

  return 'pre_season';
}

/**
 * Select a player summary for persistence / API responses.
 */
function playerSnapshot(p) {
  return {
    id:           p.id,
    code:         p.code,
    web_name:     p.web_name,
    first_name:   p.first_name,
    second_name:  p.second_name,
    element_type: p.element_type,
    team:         p.team,
    now_cost:     p.now_cost,
    ep_next:      ep(p),
    total_points: p.total_points,
    opponent_short: p.opponent_short || '-',
    opponents:    p.opponents || [],
    is_home:      p.is_home,
    status:       p.status,
    in_dreamteam: p.in_dreamteam,
  };
}

// ─── Budget squad generation ──────────────────────────────────────────────────

/**
 * Generate a 15-player squad within the £100m budget using a two-phase greedy
 * algorithm:
 *
 * Phase 1 — Value selection:
 *   For each required position (2 GKP, 5 DEF, 5 MID, 3 FWD), pick the best
 *   players by predicted points allowing up to 130 % of that position's share
 *   of the total budget, while tracking a single shared remaining-budget pot.
 *
 * Phase 2 — Fallback fill:
 *   Any position slot not filled in Phase 1 (due to budget exhaustion) is
 *   filled with the cheapest available player for that position.
 *
 * Club constraint: no more than MAX_CLUB (3) players from the same club.
 *
 * @param {Object[]} enrichedPlayers - All players enriched with ep_next / now_cost.
 * @returns {Object[]} Exactly 15 selected players (or fewer if data is sparse).
 */
function generateBudgetedSquad(enrichedPlayers) {
  const available = enrichedPlayers.filter(
    p => p.now_cost > 0 && REQUIRED_COUNTS[p.element_type] != null && p.status !== 'u',
  );

  const selected   = [];
  const clubCounts = {};
  const selectedIds = new Set();
  let remainingBudget = TOTAL_BUDGET;

  const isPickable = (p) =>
    !selectedIds.has(p.id) && (clubCounts[p.team] || 0) < MAX_CLUB;

  const getPosCounts = () => {
    const c = { 1: 0, 2: 0, 3: 0, 4: 0 };
    selected.forEach(p => { c[p.element_type] = (c[p.element_type] || 0) + 1; });
    return c;
  };

  const commit = (player) => {
    selected.push(player);
    clubCounts[player.team] = (clubCounts[player.team] || 0) + 1;
    selectedIds.add(player.id);
    remainingBudget -= player.now_cost;
  };

  // Phase 1: greedy by predicted points within proportional budget share
  for (const [posStr, required] of Object.entries(REQUIRED_COUNTS)) {
    const pos      = parseInt(posStr, 10);
    const posShare = (required / 15) * TOTAL_BUDGET;

    const candidates = available
      .filter(p => p.element_type === pos && isPickable(p))
      .sort((a, b) => ep(b) - ep(a));

    let posSpend    = 0;
    const posChosen = [];

    for (const player of candidates) {
      const counts = getPosCounts();
      if (counts[pos] + posChosen.length >= required) break;
      if (
        posSpend + player.now_cost <= posShare * 1.3 &&
        player.now_cost <= remainingBudget
      ) {
        posChosen.push(player);
        posSpend += player.now_cost;
      }
    }

    for (const player of posChosen) commit(player);
  }

  // Phase 2: fill any positions still short using cheapest available players
  for (const [posStr, required] of Object.entries(REQUIRED_COUNTS)) {
    const pos    = parseInt(posStr, 10);
    const counts = getPosCounts();
    if (counts[pos] >= required) continue;

    const cheapest = available
      .filter(p => p.element_type === pos && isPickable(p))
      .sort((a, b) => a.now_cost - b.now_cost);

    for (const player of cheapest) {
      const counts2 = getPosCounts();
      if (counts2[pos] >= required) break;
      if (player.now_cost <= remainingBudget) commit(player);
    }
  }

  return selected;
}

// ─── Captain helpers ──────────────────────────────────────────────────────────

function bestOutfieldPlayer(squad) {
  const outfield = squad.filter(p => p.element_type !== 1 && p.element_type !== 5);
  if (!outfield.length) return null;
  return outfield.reduce((best, p) => (ep(p) > ep(best) ? p : best));
}

function secondBestOutfieldPlayer(squad, captainId) {
  const outfield = squad.filter(p => p.element_type !== 1 && p.element_type !== 5 && p.id !== captainId);
  if (!outfield.length) return null;
  return outfield.reduce((best, p) => (ep(p) > ep(best) ? p : best));
}

// ─── Free-transfer calculator ─────────────────────────────────────────────────

function computeFreeTransfers(gwHistory, upToGameweek) {
  let ft = 1;
  const sorted = [...gwHistory].sort((a, b) => a.event - b.event);
  for (const gw of sorted) {
    if (gw.event >= upToGameweek) break;
    if (gw.event_chip === 'freehit') {
      ft = Math.min(2, ft + 1);
    } else if (gw.event_chip === 'wildcard') {
      ft = 1;
    } else {
      const remaining = Math.max(0, ft - (gw.event_transfers || 0));
      ft = Math.min(2, remaining + 1);
    }
  }
  return ft;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get the full predictor team state, generating or refreshing as needed.
 *
 * Returned shape:
 * {
 *   phase:            'pre_season' | 'active'
 *   source:           'pre_season_generated' | 'pre_season_no_team_id' | 'managed_team' | 'persisted_fallback'
 *   squad:            Object[]     — 15 player objects
 *   captainId:        number|null
 *   viceCaptainId:    number|null
 *   bank:             number       — 0.1m units
 *   teamValue:        number       — 0.1m units
 *   freeTransfers:    number|null
 *   currentGameweek:  number
 *   applicationTeamId: string|null
 *   teamName:         string       — only for managed teams
 *   overallRank:      number|null  — only for managed teams
 *   gwPoints:         number|null  — only for managed teams
 *   generatedAt:      string|null  — ISO timestamp
 *   warning?:         string       — present when recommendations are unavailable
 * }
 */
async function getOrGeneratePredictorTeam(bootstrap, fixtures) {
  const { events, teams, elements } = bootstrap;
  const phase = detectSeasonPhase(events);
  const currentEvent =
    events.find(e => e.is_current) ||
    events.find(e => !e.finished) ||
    events[0];
  const currentGwId = currentEvent?.id || 1;
  const applicationTeamId = getApplicationTeamId();

  // Enrich players with opponent data (opponent-display enrichment is sync)
  let players = elements.map(p => ({ ...p, ep_next: parseFloat(p.ep_next) || 0 }));
  players = fplModel.enrichPlayersWithOpponents(players, fixtures, teams, currentGwId);

  const persisted = teamStateRepository.loadState();

  // ── Pre-season ──────────────────────────────────────────────────────────────
  if (phase === 'pre_season') {
    // Apply predictions for quality squad generation
    try {
      players = await fplModel.applyPredictionsWithCache(
        players, fixtures, teams, currentGwId, 'predictor-preseason',
      );
    } catch (err) {
      console.warn('[predictorTeamService] Prediction cache unavailable:', err.message);
    }

    // Return existing persisted squad if it was built from valid data
    if (persisted?.squad?.length === 15 && persisted.source === 'pre_season_generated') {
      return {
        phase,
        source:           'pre_season_generated',
        squad:            persisted.squad,
        captainId:        persisted.captainId,
        viceCaptainId:    persisted.viceCaptainId,
        bank:             persisted.bank || 0,
        teamValue:        persisted.teamValue || TOTAL_BUDGET,
        freeTransfers:    1,
        currentGameweek:  currentGwId,
        applicationTeamId: null,
        generatedAt:      persisted.generatedAt,
      };
    }

    // Generate fresh pre-season squad
    const squadPlayers   = generateBudgetedSquad(players);
    const captain        = bestOutfieldPlayer(squadPlayers);
    const viceCaptain    = secondBestOutfieldPlayer(squadPlayers, captain?.id);
    const teamValue      = squadPlayers.reduce((s, p) => s + p.now_cost, 0);
    const bank           = TOTAL_BUDGET - teamValue;

    const state = {
      source:           'pre_season_generated',
      squad:            squadPlayers.map(playerSnapshot),
      captainId:        captain?.id || null,
      viceCaptainId:    viceCaptain?.id || null,
      bank,
      teamValue,
      generatedAt:      new Date().toISOString(),
      generatedForGameweek: currentGwId,
    };
    teamStateRepository.saveState(state);

    return {
      phase,
      source:           'pre_season_generated',
      squad:            state.squad,
      captainId:        state.captainId,
      viceCaptainId:    state.viceCaptainId,
      bank,
      teamValue,
      freeTransfers:    1,
      currentGameweek:  currentGwId,
      applicationTeamId: null,
      generatedAt:      state.generatedAt,
    };
  }

  // ── Active season — no APPLICATION_TEAM configured ─────────────────────────
  if (!applicationTeamId) {
    const baseSquad = persisted?.squad || [];
    return {
      phase,
      source:           'pre_season_no_team_id',
      squad:            baseSquad,
      captainId:        persisted?.captainId || null,
      viceCaptainId:    persisted?.viceCaptainId || null,
      bank:             persisted?.bank || 0,
      teamValue:        persisted?.teamValue || 0,
      freeTransfers:    null,
      currentGameweek:  currentGwId,
      applicationTeamId: null,
      generatedAt:      persisted?.generatedAt || null,
      warning:
        'APPLICATION_TEAM environment variable is not configured. ' +
        'Showing the pre-season generated squad. ' +
        'Recommendation generation is disabled until APPLICATION_TEAM is set.',
    };
  }

  // ── Active season — load managed team from FPL ─────────────────────────────
  try {
    // Enrich with predictions for the current GW
    players = await fplModel.applyPredictionsWithCache(
      players, fixtures, teams, currentGwId, 'predictor-managed',
    );

    const [picksData, entryData, historyData] = await Promise.all([
      fplModel.fetchPlayerPicks(applicationTeamId, currentGwId),
      dataProvider.fetchEntry(applicationTeamId),
      dataProvider.fetchHistory(applicationTeamId),
    ]);

    const playerMap = {};
    players.forEach(p => { playerMap[p.id] = p; });

    const picks       = picksData.picks || [];
    const captainPick = picks.find(p => p.is_captain);
    const vcPick      = picks.find(p => p.is_vice_captain);

    const squadPlayers = picks
      .sort((a, b) => a.position - b.position)
      .map(pick => {
        const raw = playerMap[pick.element];
        if (!raw) return null;
        return {
          ...playerSnapshot(raw),
          is_captain:      pick.is_captain,
          is_vice_captain: pick.is_vice_captain,
          multiplier:      pick.multiplier,
          isActive:        pick.position <= 11,
          slot:            pick.position,
        };
      })
      .filter(Boolean);

    const teamValue   = picksData.entry_history?.value ?? squadPlayers.reduce((s, p) => s + p.now_cost, 0);
    const bank        = picksData.entry_history?.bank  ?? 0;
    const gwHistory   = (historyData.current || []);
    const freeTransfers = computeFreeTransfers(gwHistory, currentGwId);

    const currentHistory = gwHistory.find(h => h.event === currentGwId);
    const overallRank    = currentHistory?.overall_rank || null;
    const gwPoints       = currentHistory?.points       || null;

    const teamName = entryData.player_first_name
      ? `${entryData.player_first_name} ${entryData.player_last_name}`
      : '';

    // Persist updated live state
    teamStateRepository.saveState({
      source:           'managed_team',
      squad:            squadPlayers,
      captainId:        captainPick?.element || null,
      viceCaptainId:    vcPick?.element      || null,
      bank,
      teamValue,
      freeTransfers,
      updatedAt:        new Date().toISOString(),
      gameweek:         currentGwId,
      teamName,
    });

    return {
      phase,
      source:           'managed_team',
      squad:            squadPlayers,
      captainId:        captainPick?.element || null,
      viceCaptainId:    vcPick?.element      || null,
      bank,
      teamValue,
      freeTransfers,
      currentGameweek:  currentGwId,
      applicationTeamId,
      teamName,
      overallRank,
      gwPoints,
      generatedAt:      null,
    };
  } catch (err) {
    console.error('[predictorTeamService] Error loading managed team:', err.message);
    // Fall back to last persisted state with a warning
    const baseSquad = persisted?.squad || [];
    return {
      phase,
      source:           'persisted_fallback',
      squad:            baseSquad,
      captainId:        persisted?.captainId     || null,
      viceCaptainId:    persisted?.viceCaptainId || null,
      bank:             persisted?.bank          || 0,
      teamValue:        persisted?.teamValue     || 0,
      freeTransfers:    persisted?.freeTransfers || 1,
      currentGameweek:  currentGwId,
      applicationTeamId,
      generatedAt:      null,
      warning:          'Could not load live team data from FPL. Showing last saved squad.',
    };
  }
}

module.exports = {
  getOrGeneratePredictorTeam,
  detectSeasonPhase,
  getApplicationTeamId,
  generateBudgetedSquad,
  TOTAL_BUDGET,
};
