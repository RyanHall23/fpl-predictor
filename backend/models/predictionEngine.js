'use strict';

/**
 * Advanced FPL Prediction Engine — Main Orchestrator
 *
 * Produces expected FPL points for every player in an upcoming gameweek by
 * composing ten specialist models:
 *
 *   1. ELO team-strength model      → per-fixture expected goals (lambdas)
 *   2. Monte Carlo match simulator  → goal/assist distributions per player
 *   3. Minutes model                → P(start), P(sub), P(60+ mins)
 *   4. Player contribution model    → goal/assist shares
 *   5. Goalkeeper save model        → expected saves & save points
 *   6. Defensive contribution model → P(reaching action threshold)
 *   7. Discipline model             → P(yellow/red card)
 *   8. Bonus model                  → expected BPS & bonus points
 *   9. FPL scorer                   → applies official scoring rules
 *  10. Floor / ceiling projection   → variance-based range
 *
 * Supports Double Gameweeks (DGW): points from each fixture are summed.
 *
 * Output per player includes all fields required by the API:
 *   predicted_points, expected_goals, expected_assists,
 *   clean_sheet_probability, expected_minutes, expected_saves,
 *   yellow_card_probability, red_card_probability,
 *   bonus_probability, confidence_score, floor_points, ceiling_points
 */

const eloModel              = require('./prediction/eloModel');
const matchSimulator        = require('./prediction/matchSimulator');
const minutesModel          = require('./prediction/minutesModel');
const playerContribution    = require('./prediction/playerContributionModel');
const goalkeeperModel       = require('./prediction/goalkeeperModel');
const defensiveModel        = require('./prediction/defensiveModel');
const disciplineModel       = require('./prediction/disciplineModel');
const bonusModel            = require('./prediction/bonusModel');
const fplScorer             = require('./prediction/fplScorer');
const { cleanSheetProbability } = require('./prediction/poissonModel');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const round2 = (v) => Math.round(v * 100) / 100;

/** Build a map of team_id → [players on that team]. */
const buildTeamPlayerMap = (players) => {
  const map = {};
  players.forEach((p) => {
    if (!map[p.team]) map[p.team] = [];
    map[p.team].push(p);
  });
  return map;
};

/**
 * Compute floor and ceiling projections based on expected points and their
 * inherent variance.  Uses a heuristic variance estimate proportional to the
 * point value itself (higher predictions → wider spread).
 *
 * @param {number} predicted - Expected points
 * @returns {{ floor: number, ceiling: number }}
 */
const floorCeiling = (predicted) => {
  // Sigma grows with the square root of predicted points (Poisson-like behaviour)
  const sigma = Math.max(0.5, Math.sqrt(predicted) * 0.9);
  return {
    floor:   Math.max(0, round2(predicted - sigma)),
    ceiling: round2(predicted + 2 * sigma),
  };
};

// ─── Fixture simulation setup ─────────────────────────────────────────────────

/**
 * Build the array of player objects required by the match simulator
 * for one side of a fixture.  Each entry carries goalShare and assistShare.
 *
 * Goalkeepers are included in the array (so they appear in simulation results)
 * but receive zero goalShare and assistShare — they cannot score or assist.
 *
 * @param {Array} teamPlayers - All players on the team
 * @returns {Array} Simulator-ready player array
 */
const buildSimulatorPlayers = (teamPlayers) => {
  // Only outfield players contribute to goal/assist allocation
  const outfieldPlayers = teamPlayers.filter((p) => p.element_type !== 1);

  // Compute total involvement score for normalisation (outfield only)
  const totalInvolvement = outfieldPlayers.reduce(
    (s, p) => s + playerContribution.attackingInvolvementScore(p),
    0,
  );

  return teamPlayers.map((p) => {
    if (p.element_type === 1) {
      // GK: participates in the simulation for clean-sheet tracking only
      return { ...p, goalShare: 0, assistShare: 0 };
    }
    const inv   = playerContribution.attackingInvolvementScore(p);
    const share = totalInvolvement > 0 ? inv / totalInvolvement : 1 / Math.max(1, outfieldPlayers.length);
    return {
      ...p,
      goalShare:   Math.max(0, share),
      // Assist share is slightly lower than goal share: assists are more diffuse
      // (build-up play can involve multiple players), while goals are more concentrated
      // in the highest-xG player.  The 0.85 factor reflects this spreading effect.
      assistShare: Math.max(0, share * 0.85),
    };
  });
};

// ─── Per-fixture prediction ───────────────────────────────────────────────────

/**
 * Compute the prediction for a single player in a single fixture.
 *
 * @param {Object} player             - FPL element
 * @param {Object} fixtureCtx        - { isHome, homeLambda, awayLambda }
 * @param {Array}  teamPlayers       - All players on the same team
 * @param {Object} simResults        - Output of matchSimulator.runSimulations()
 * @param {number} seasonGamesPlayed - Games completed in the season (used by minutes model)
 * @returns {Object} Per-fixture prediction fields
 */
const computeFixturePrediction = (player, fixtureCtx, teamPlayers, simResults, seasonGamesPlayed) => {
  const { isHome, homeLambda, awayLambda } = fixtureCtx;
  const teamLambda     = isHome ? homeLambda : awayLambda;
  const opponentLambda = isHome ? awayLambda : homeLambda;

  // ── Minutes ────────────────────────────────────────────────────────────────
  const mins          = minutesModel.estimateMinutesProbabilities(player, seasonGamesPlayed);
  const minutesFrac   = mins.expectedMinutes / 90;
  const pPlay         = Math.min(1, mins.pStart + mins.pSubAppearance);

  // ── Goal / assist contribution (from simulation) ──────────────────────────
  const sim = simResults[player.id] || {};
  // Scale simulated averages by P(play) so benched players earn zero
  const expGoals   = (sim.avgGoals   || 0) * pPlay;
  const expAssists = (sim.avgAssists || 0) * pPlay;
  const csProb     = sim.cleanSheetProb ?? cleanSheetProbability(opponentLambda);

  // ── Goalkeeper-specific ────────────────────────────────────────────────────
  let expSavePoints = 0;
  let expSaves      = 0;
  if (player.element_type === fplScorer.GK) {
    const gkData    = goalkeeperModel.predictGoalkeeperContribution(opponentLambda);
    expSaves        = gkData.expectedSaves      * minutesFrac;
    expSavePoints   = gkData.expectedSavePoints * minutesFrac;
  }

  // ── Defensive contribution ────────────────────────────────────────────────
  const defContrib  = defensiveModel.computeDefensiveContribution(player, minutesFrac);

  // ── Discipline ────────────────────────────────────────────────────────────
  const discipline  = disciplineModel.computeDisciplineRisk(player, minutesFrac);

  // ── Bonus ─────────────────────────────────────────────────────────────────
  const bonusResult = bonusModel.estimateBPS(player, {
    expectedGoals:            expGoals,
    expectedAssists:          expAssists,
    cleanSheetProb:           csProb,
    expectedSaves:            expSaves,
    expectedDefensiveActions: defContrib.expectedDefensiveActions,
    minutesFraction:          minutesFrac,
  });

  // ── FPL scoring ───────────────────────────────────────────────────────────
  const scored = fplScorer.computeExpectedFPLPoints(player, {
    pStart:              mins.pStart,
    pSubAppearance:      mins.pSubAppearance,
    p60Plus:             mins.p60Plus,
    expectedGoals:       expGoals,
    expectedAssists:     expAssists,
    cleanSheetProb:      csProb,
    expectedSavePoints:  expSavePoints,
    pYellowCard:         discipline.pYellowCard,
    pRedCard:            discipline.pRedCard,
    pDefensiveBonus:     defContrib.pThreshold,
    expectedBonus:       bonusResult.expectedBonus,
    goalsConcededLambda: opponentLambda,
  });

  return {
    predictedPoints:       scored.total,
    expectedGoals:         expGoals,
    expectedAssists:       expAssists,
    cleanSheetProbability: csProb,
    expectedMinutes:       mins.expectedMinutes,
    expectedSaves:         expSaves,
    yellowCardProbability: discipline.pYellowCard,
    redCardProbability:    discipline.pRedCard,
    bonusProbability:      bonusResult.pBonus,
    expectedBonus:         bonusResult.expectedBonus,
    pStart:                mins.pStart,
    pSubAppearance:        mins.pSubAppearance,
    p60Plus:               mins.p60Plus,
    breakdown:             scored,
  };
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Compute advanced FPL predictions for all players for a specific gameweek.
 *
 * @param {Array}  players       - All FPL elements from bootstrap-static
 * @param {Array}  fixtures      - All fixtures
 * @param {Array}  teams         - All teams from bootstrap-static
 * @param {number} targetEventId - Gameweek number to predict
 * @returns {Array} Copy of players array with prediction fields added / updated
 */
const computePredictions = (players, fixtures, teams, targetEventId) => {
  // ── 1. Build team ELO ratings ─────────────────────────────────────────────
  const teamRatings   = eloModel.buildTeamRatings(teams);

  // ── 2. Build team → players map ───────────────────────────────────────────
  const teamPlayerMap = buildTeamPlayerMap(players);

  // ── 3. Compute season games played ───────────────────────────────────────
  // Count distinct completed gameweeks (events) from the fixtures array.
  // We accept fixtures where finished === true, OR where the finished field
  // is absent (null/undefined) — the latter handles mock/test data that omits
  // the field.  In both cases, event < targetEventId is the primary guard so
  // we only count past gameweeks.
  const completedEvents = new Set(
    fixtures
      .filter((f) => f.event != null && f.event < targetEventId && f.finished !== false)
      .map((f) => f.event),
  );
  // Fall back to targetEventId - 1 if the fixtures data carries no finished flags.
  const seasonGamesPlayed = completedEvents.size > 0
    ? completedEvents.size
    : Math.max(1, targetEventId - 1);

  // ── 3b. Per-team games played ─────────────────────────────────────────────
  // Some teams have played fewer PL matches than the global completed-GW count
  // due to postponements, FA Cup blank rounds, etc.  Using the global count as
  // the denominator for starts/gamesPlayed would understate pStart for players
  // on those teams (e.g. an Arsenal defender with 24 starts in 26 team matches
  // would have pStart = 24/29 ≈ 0.83 instead of the correct 24/26 ≈ 0.92).
  //
  // Proxy: the maximum 'starts' value among all players on a team closely
  // approximates how many PL matches that team has played — the most-used
  // outfield player (or first-choice goalkeeper) will have starts ≈ team games.
  const teamGamesPlayedMap = {};
  players.forEach((p) => {
    const tid = p.team;
    const s = parseFloat(p.starts) || 0;  // starts is an integer in FPL data
    if (s > (teamGamesPlayedMap[tid] || 0)) {
      teamGamesPlayedMap[tid] = s;
    }
  });
  // Fallback for teams with no players who have starts data (e.g. brand-new teams
  // in test fixtures or mid-season transfers with no recorded appearances yet)
  Object.keys(teamPlayerMap).forEach((tid) => {
    if (teamGamesPlayedMap[tid] === undefined) teamGamesPlayedMap[tid] = seasonGamesPlayed;
  });

  // ── 4. Identify gameweek fixtures ─────────────────────────────────────────
  const gwFixtures = fixtures.filter((f) => f.event === targetEventId);

  if (gwFixtures.length === 0) {
    // Blank gameweek for all — return zeros
    return players.map((p) => ({
      ...p,
      ep_next:                   0,
      predicted_points:          0,
      expected_goals:            0,
      expected_assists:          0,
      clean_sheet_probability:   0,
      expected_minutes:          0,
      expected_saves:            0,
      yellow_card_probability:   0,
      red_card_probability:      0,
      bonus_probability:         0,
      confidence_score:          0,
      floor_points:              0,
      ceiling_points:            0,
      fixture_count:             0,
    }));
  }

  // ── 4. Compute expected goals per fixture & run simulations ───────────────
  const fixtureSimResults = {};
  const teamFixtureMap    = {};  // team_id → [{ fixtureId, isHome, homeLambda, awayLambda }]

  gwFixtures.forEach((fixture) => {
    const { homeLambda, awayLambda } = eloModel.computeExpectedGoals(
      fixture.team_h,
      fixture.team_a,
      teamRatings,
    );

    // Map teams to fixtures
    [fixture.team_h, fixture.team_a].forEach((teamId) => {
      if (!teamFixtureMap[teamId]) teamFixtureMap[teamId] = [];
      teamFixtureMap[teamId].push({
        fixtureId:  fixture.id,
        isHome:     teamId === fixture.team_h,
        homeLambda,
        awayLambda,
      });
    });

    // Build simulation player arrays
    const homeSimPlayers = buildSimulatorPlayers(teamPlayerMap[fixture.team_h] || []);
    const awaySimPlayers = buildSimulatorPlayers(teamPlayerMap[fixture.team_a] || []);

    fixtureSimResults[fixture.id] = matchSimulator.runSimulations(
      homeLambda,
      awayLambda,
      homeSimPlayers,
      awaySimPlayers,
    );
  });

  // ── 5. Compute per-player predictions ─────────────────────────────────────
  return players.map((player) => {
    const playerFixtures = teamFixtureMap[player.team] || [];

    if (playerFixtures.length === 0) {
      // Blank gameweek for this player's team
      return {
        ...player,
        ep_next:                   0,
        predicted_points:          0,
        expected_goals:            0,
        expected_assists:          0,
        clean_sheet_probability:   0,
        expected_minutes:          0,
        expected_saves:            0,
        yellow_card_probability:   0,
        red_card_probability:      0,
        bonus_probability:         0,
        confidence_score:          0,
        floor_points:              0,
        ceiling_points:            0,
        fixture_count:             0,
      };
    }

    const teamPlayers = teamPlayerMap[player.team] || [];

    // Sum contributions across all fixtures (DGW support)
    let totalPts       = 0;
    let totalGoals     = 0;
    let totalAssists   = 0;
    let totalMins      = 0;
    let totalSaves     = 0;
    // For probabilities, take the maximum across fixtures (or union probability)
    let maxCS          = 0;
    let maxYellow      = 0;
    let maxRed         = 0;
    let maxBonus       = 0;

    const teamGamesPlayed = teamGamesPlayedMap[player.team] || seasonGamesPlayed;

    playerFixtures.forEach((fc) => {
      const simResults = fixtureSimResults[fc.fixtureId] || {};
      const pred       = computeFixturePrediction(player, fc, teamPlayers, simResults, teamGamesPlayed);

      totalPts     += pred.predictedPoints;
      totalGoals   += pred.expectedGoals;
      totalAssists += pred.expectedAssists;
      totalMins    += pred.expectedMinutes;
      totalSaves   += pred.expectedSaves;
      // Union probability: P(event in ≥1 fixture) = 1 − ∏(1−P(event in fixture_i))
      maxCS     = 1 - (1 - maxCS)     * (1 - pred.cleanSheetProbability);
      maxYellow = 1 - (1 - maxYellow) * (1 - pred.yellowCardProbability);
      maxRed    = 1 - (1 - maxRed)    * (1 - pred.redCardProbability);
      maxBonus  = 1 - (1 - maxBonus)  * (1 - pred.bonusProbability);
    });

    // ── 6. Confidence score ────────────────────────────────────────────────
    // Based on data richness: xG availability, minutes history, injury info.
    const hasXG      = player.expected_goals != null && parseFloat(player.expected_goals) >= 0;
    const hasMins    = (player.minutes || 0) > 45;
    const hasChance  = player.chance_of_playing_next_round != null;
    const confidence = 0.35 + (hasXG ? 0.30 : 0) + (hasMins ? 0.25 : 0) + (hasChance ? 0.10 : 0);

    // ── 7. Floor / ceiling ─────────────────────────────────────────────────
    const { floor, ceiling } = floorCeiling(totalPts);

    return {
      ...player,
      ep_next:                   round2(totalPts),   // Overwrite FPL's ep_next
      predicted_points:          round2(totalPts),
      expected_goals:            round2(totalGoals),
      expected_assists:          round2(totalAssists),
      clean_sheet_probability:   round2(Math.min(1, maxCS)),
      expected_minutes:          round2(Math.min(90 * playerFixtures.length, totalMins)),
      expected_saves:            round2(totalSaves),
      yellow_card_probability:   round2(Math.min(1, maxYellow)),
      red_card_probability:      round2(Math.min(1, maxRed)),
      bonus_probability:         round2(Math.min(1, maxBonus)),
      confidence_score:          round2(confidence),
      floor_points:              floor,
      ceiling_points:            ceiling,
      fixture_count:             playerFixtures.length,
    };
  });
};

module.exports = {
  computePredictions,
  computeFixturePrediction,
};
