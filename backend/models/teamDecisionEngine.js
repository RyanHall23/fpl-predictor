'use strict';

/**
 * teamDecisionEngine
 *
 * Generates weekly recommendations for the FPL Predictor's Team:
 *   - Captain / vice-captain selection
 *   - Optimal starting XI and bench order
 *   - Transfer suggestions (out → best available in)
 *   - Chip suggestion heuristics
 *
 * Reuses enriched player data already produced by fplModel / predictionEngine
 * so no additional API calls are needed here.
 */

const POSITION_NAMES = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };
const MAX_CLUB = 3;

// Minimum valid FPL formation counts for the starting XI
const MIN_DEF = 3;
const MIN_MID = 2;
const MIN_FWD = 1;

/**
 * Select the optimal starting XI and bench order from 15 squad players,
 * respecting FPL formation rules (1 GK, ≥3 DEF, ≥2 MID, ≥1 FWD).
 *
 * @param {Object[]} squad - All 15 squad players (active + bench mixed).
 * @returns {{ active: Object[], bench: Object[] }}
 */
function selectBestLineup(squad) {
  const ep = (p) => parseFloat(p.ep_next) || 0;

  const gks  = squad.filter(p => p.element_type === 1).sort((a, b) => ep(b) - ep(a));
  const defs = squad.filter(p => p.element_type === 2).sort((a, b) => ep(b) - ep(a));
  const mids = squad.filter(p => p.element_type === 3).sort((a, b) => ep(b) - ep(a));
  const fwds = squad.filter(p => p.element_type === 4).sort((a, b) => ep(b) - ep(a));

  // Start with mandatory minimums
  const active = [
    gks[0],
    ...defs.slice(0, MIN_DEF),
    ...mids.slice(0, MIN_MID),
    ...fwds.slice(0, MIN_FWD),
  ].filter(Boolean);

  // Pool of remaining players to fill up to 11
  const remaining = [
    ...defs.slice(MIN_DEF),
    ...mids.slice(MIN_MID),
    ...fwds.slice(MIN_FWD),
  ].sort((a, b) => ep(b) - ep(a));

  while (active.length < 11 && remaining.length > 0) {
    const candidate = remaining.shift();
    if (!candidate) break;
    const defCount = active.filter(p => p.element_type === 2).length;
    const midCount = active.filter(p => p.element_type === 3).length;
    const fwdCount = active.filter(p => p.element_type === 4).length;
    if (candidate.element_type === 2 && defCount >= 5) continue;
    if (candidate.element_type === 3 && midCount >= 5) continue;
    if (candidate.element_type === 4 && fwdCount >= 3) continue;
    active.push(candidate);
  }

  const activeIds = new Set(active.map(p => p.id));

  // Bench: GK reserve first, then outfield by ep_next
  const benchGk      = gks.slice(1).filter(p => !activeIds.has(p.id));
  const benchOutfield = squad
    .filter(p => !activeIds.has(p.id) && p.element_type !== 1)
    .sort((a, b) => ep(b) - ep(a));
  const bench = [...benchGk, ...benchOutfield];

  return { active, bench };
}

/**
 * Pick the captain (highest ep_next among outfield active players).
 */
function pickCaptain(activePlayers) {
  const ep = (p) => parseFloat(p.ep_next) || 0;
  const outfield = activePlayers.filter(p => p.element_type !== 1 && p.element_type !== 5);
  if (!outfield.length) return null;
  return outfield.reduce((best, p) => (ep(p) > ep(best) ? p : best));
}

/**
 * Pick the vice-captain (second-highest ep_next, excluding the captain).
 */
function pickViceCaptain(activePlayers, captainId) {
  const ep = (p) => parseFloat(p.ep_next) || 0;
  const outfield = activePlayers.filter(
    p => p.element_type !== 1 && p.element_type !== 5 && p.id !== captainId,
  );
  if (!outfield.length) return null;
  return outfield.reduce((best, p) => (ep(p) > ep(best) ? p : best));
}

/**
 * Generate transfer suggestions: for each position, find the weakest squad
 * player that has a clearly better affordable replacement available.
 *
 * @param {Object[]} squad       - Current 15-player squad.
 * @param {Object[]} allPlayers  - All FPL players enriched with ep_next.
 * @param {number}   bank        - Available funds (in 0.1m units).
 * @returns {Object[]} Transfer suggestions sorted by descending points gain.
 */
function suggestTransfers(squad, allPlayers, bank) {
  const ep = (p) => parseFloat(p.ep_next) || 0;
  const squadIds = new Set(squad.map(p => p.id));

  const clubCounts = {};
  squad.forEach(p => { clubCounts[p.team] = (clubCounts[p.team] || 0) + 1; });

  const suggestions = [];

  for (const posType of [1, 2, 3, 4]) {
    const posSquad = squad
      .filter(p => p.element_type === posType)
      .sort((a, b) => ep(a) - ep(b)); // weakest first

    if (!posSquad.length) continue;
    const weakest = posSquad[0];
    const weakEp  = ep(weakest);

    // Available affordable replacements with better predicted points
    const candidates = (allPlayers || [])
      .filter(p =>
        p.element_type === posType &&
        !squadIds.has(p.id) &&
        ep(p) > weakEp &&
        p.now_cost <= weakest.now_cost + bank &&
        (clubCounts[p.team] || 0) < MAX_CLUB,
      )
      .sort((a, b) => ep(b) - ep(a));

    if (!candidates.length) continue;
    const best = candidates[0];
    const gain = Math.round((ep(best) - weakEp) * 100) / 100;
    if (gain < 0.5) continue; // Skip trivial improvements

    suggestions.push({
      playerOut: {
        id:           weakest.id,
        code:         weakest.code,
        web_name:     weakest.web_name,
        element_type: weakest.element_type,
        position:     POSITION_NAMES[weakest.element_type],
        team:         weakest.team,
        now_cost:     weakest.now_cost,
        ep_next:      weakEp,
      },
      playerIn: {
        id:           best.id,
        code:         best.code,
        web_name:     best.web_name,
        element_type: best.element_type,
        position:     POSITION_NAMES[best.element_type],
        team:         best.team,
        now_cost:     best.now_cost,
        ep_next:      ep(best),
      },
      pointsGain: gain,
      costDelta:  best.now_cost - weakest.now_cost,
      reasoning: `${best.web_name} (${ep(best).toFixed(1)} pts) projected to significantly outperform ` +
                 `${weakest.web_name} (${weakEp.toFixed(1)} pts) — ` +
                 `${gain > 0 ? '+' : ''}${gain.toFixed(1)} pts gain`,
    });
  }

  return suggestions.sort((a, b) => b.pointsGain - a.pointsGain).slice(0, 3);
}

/**
 * Generate a simple chip suggestion based on squad state and free-transfers.
 */
function suggestChip(freeTransfers, chipAvailability) {
  if (!chipAvailability) return null;
  if (freeTransfers <= 0 && chipAvailability.wildcard) {
    return {
      chip: 'wildcard',
      reasoning: 'Multiple transfers needed — consider using Wildcard to restructure the squad without point deductions.',
    };
  }
  return null;
}

/**
 * Main entry point: generate all weekly recommendations.
 *
 * @param {Object[]} squad       - Current 15-player squad (active + bench).
 * @param {Object[]} allPlayers  - All FPL players enriched with ep_next.
 * @param {number}   gameweek    - Current / upcoming gameweek number.
 * @param {Object}   teamState   - { bank, freeTransfers, chipAvailability? }
 * @returns {Object} Recommendations object.
 */
function generateRecommendations(squad, allPlayers, gameweek, teamState) {
  const { bank = 0, freeTransfers = 1, chipAvailability = null } = teamState;
  const ep = (p) => parseFloat(p.ep_next) || 0;

  if (!squad || squad.length === 0) {
    return {
      available:     false,
      gameweek,
      generatedAt:   new Date().toISOString(),
    };
  }

  // 1. Optimal lineup
  const { active, bench } = selectBestLineup(squad);

  // 2. Captain / VC
  const captainPlayer   = pickCaptain(active);
  const vcPlayer        = pickViceCaptain(active, captainPlayer?.id);

  // 3. Predicted score (captain gets ×2)
  const predictedScore = Math.round(
    active.reduce((sum, p) => {
      const mult = p.id === captainPlayer?.id ? 2 : 1;
      return sum + ep(p) * mult;
    }, 0) * 100,
  ) / 100;

  // 4. Transfer suggestions
  const suggestedTransfers = suggestTransfers(squad, allPlayers, bank);

  // 5. Chip suggestion
  const chipSuggestion = suggestChip(freeTransfers, chipAvailability);

  return {
    available: true,
    gameweek,
    generatedAt: new Date().toISOString(),
    predictedScore,
    captain: captainPlayer ? {
      id:           captainPlayer.id,
      web_name:     captainPlayer.web_name,
      element_type: captainPlayer.element_type,
      position:     POSITION_NAMES[captainPlayer.element_type],
      team:         captainPlayer.team,
      ep_next:      ep(captainPlayer),
      reasoning:    `Highest projected score (${ep(captainPlayer).toFixed(1)} pts) among your starting outfield players`,
    } : null,
    viceCaptain: vcPlayer ? {
      id:           vcPlayer.id,
      web_name:     vcPlayer.web_name,
      element_type: vcPlayer.element_type,
      position:     POSITION_NAMES[vcPlayer.element_type],
      team:         vcPlayer.team,
      ep_next:      ep(vcPlayer),
      reasoning:    `Second-highest projected score (${ep(vcPlayer).toFixed(1)} pts) among your starting outfield players`,
    } : null,
    startingXI: active.map((p, i) => ({
      id:           p.id,
      code:         p.code,
      web_name:     p.web_name,
      element_type: p.element_type,
      position:     POSITION_NAMES[p.element_type],
      team:         p.team,
      ep_next:      ep(p),
      slot:         i + 1,
    })),
    bench: bench.map((p, i) => ({
      id:           p.id,
      code:         p.code,
      web_name:     p.web_name,
      element_type: p.element_type,
      position:     POSITION_NAMES[p.element_type],
      team:         p.team,
      ep_next:      ep(p),
      slot:         active.length + 1 + i,
    })),
    suggestedTransfers,
    chipSuggestion,
  };
}

module.exports = { generateRecommendations, selectBestLineup, pickCaptain, pickViceCaptain };
