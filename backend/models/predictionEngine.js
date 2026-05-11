'use strict';

/**
 * Advanced FPL Prediction Engine — Main Orchestrator  (v2 — re-engineered)
 *
 * Produces expected FPL points for every player in an upcoming gameweek by
 * composing twelve specialist models:
 *
 *   1.  ELO team-strength model      → per-fixture expected goals (lambdas)
 *   2.  Team form model              → recent-results lambda adjustment (new)
 *   3.  Player form model            → form-weighted xG/xA per player (new)
 *   4.  Monte Carlo match simulator  → goal/assist distributions per player
 *   5.  Minutes model                → P(start), P(sub), P(60+ mins)
 *   6.  Player contribution model    → goal/assist shares (form-aware)
 *   7.  Goalkeeper save model        → expected saves & save points
 *   8.  Defensive contribution model → P(reaching action threshold)
 *   9.  Discipline model             → P(yellow/red card)
 *  10.  Bonus model                  → expected BPS & bonus points
 *  11.  FPL scorer                   → applies official scoring rules
 *  12.  Calibration store            → per-position learned bias correction (new)
 *
 * Additional accuracy improvements over v1:
 *   - Form-adjusted xG/xA blend ICT threat/creativity with season stats
 *   - Team recent results (last 5 games) modulate fixture lambdas
 *   - xG differential regression corrects lucky/unlucky conversion rates
 *   - Transfer market sentiment provides a market-wisdom signal
 *   - Confidence score reflects calibration quality and data richness
 *   - Floor/ceiling use calibrated points for tighter, truer ranges
 *   - Backtesting against last 3 completed GWs drives calibration multipliers
 *
 * Backtesting & calibration lifecycle:
 *   - `computePredictions(...)` is synchronous and always fast
 *   - Calibration is loaded from disk at startup (calibration.json)
 *   - Call `calibrate(players, fixtures, teams, currentGwId)` (async) once
 *     per request cycle to refresh calibration — handled by fplModel
 *
 * Supports Double Gameweeks (DGW): points from each fixture are summed.
 */

const eloModel              = require('./prediction/eloModel');
const teamFormModel         = require('./prediction/teamFormModel');
const formModel             = require('./prediction/formModel');
const matchSimulator        = require('./prediction/matchSimulator');
const minutesModel          = require('./prediction/minutesModel');
const playerContribution    = require('./prediction/playerContributionModel');
const goalkeeperModel       = require('./prediction/goalkeeperModel');
const defensiveModel        = require('./prediction/defensiveModel');
const disciplineModel       = require('./prediction/disciplineModel');
const bonusModel            = require('./prediction/bonusModel');
const fplScorer             = require('./prediction/fplScorer');
const calibrationStore      = require('./prediction/calibrationStore');
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

  // Compute separate assist-involvement scores (weighted toward xA players)
  const assistInvolvementScore = (p) => {
    const xA  = parseFloat(p._form_xa ?? p.expected_assists ?? 0) || 0;
    const xG  = parseFloat(p._form_xg ?? p.expected_goals   ?? 0) || 0;
    // Base off raw involvement but tilt toward xA relative to xG
    const base = playerContribution.attackingInvolvementScore(p);
    // Boost players whose primary contribution is assists
    const xaRatio = (xA + 0.01) / (xG + xA + 0.02);
    return base * (0.5 + xaRatio);
  };

  const totalAssistInvolvement = outfieldPlayers.reduce(
    (s, p) => s + assistInvolvementScore(p),
    0,
  );

  return teamPlayers.map((p) => {
    if (p.element_type === 1) {
      // GK: participates in the simulation for clean-sheet tracking only
      return { ...p, goalShare: 0, assistShare: 0 };
    }
    const inv        = playerContribution.attackingInvolvementScore(p);
    const goalShare  = totalInvolvement > 0 ? inv / totalInvolvement : 1 / Math.max(1, outfieldPlayers.length);

    const assInv     = assistInvolvementScore(p);
    const assistShare = totalAssistInvolvement > 0 ? assInv / totalAssistInvolvement : goalShare * 0.85;

    return {
      ...p,
      goalShare:   Math.max(0, goalShare),
      assistShare: Math.max(0, assistShare),
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
  const discipline  = disciplineModel.computeDisciplineRisk(player, minutesFrac, {
    homeElo: fixtureCtx.homeElo ?? null,
    awayElo: fixtureCtx.awayElo ?? null,
  });

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
 * @param {Array}  players        - All FPL elements from bootstrap-static
 * @param {Array}  fixtures       - All fixtures
 * @param {Array}  teams          - All teams from bootstrap-static
 * @param {number} targetEventId  - Gameweek number to predict
 * @param {Object} [options]      - Optional flags
 *   @param {boolean} [options.skipCalibration=false]
 *       When true, calibration multipliers are NOT applied.  Used by the
 *       backtest engine so raw predictions can be compared against actuals.
 * @returns {Array} Copy of players array with prediction fields added / updated
 */
const computePredictions = (players, fixtures, teams, targetEventId, options = {}) => {
  const { skipCalibration = false } = options;

  // ── 1. Build completed-fixture filter (shared by ELO, form, and team-context) ─
  const completedFixturesBeforeTarget = fixtures.filter(
    (f) => f.event != null && f.event < targetEventId && f.finished === true,
  );

  // ── 2. Build team ELO ratings ─────────────────────────────────────────────
  const teamRatings   = eloModel.buildTeamRatings(teams);

  // ── 2b. Build dynamic (result-based) ELO ratings ─────────────────────────
  //    Replays completed fixtures to compute live-season Elo per team.
  //    Blended 40% into lambda computation below alongside static ratings.
  const dynamicTeamRatings = eloModel.buildDynamicTeamRatings(
    completedFixturesBeforeTarget, teams,
  );

  // ── 3. Build team form ratings from completed fixtures ────────────────────
  //    These modulate the ELO lambdas using each team's last 5 results.
  const teamFormRatings = teamFormModel.buildTeamFormRatings(completedFixturesBeforeTarget);

  // ── 4. Build team → players map ───────────────────────────────────────────
  const teamPlayerMap = buildTeamPlayerMap(players);

  // ── 4. Compute season games played ───────────────────────────────────────
  const completedEvents = new Set(
    fixtures
      .filter((f) => f.event != null && f.event < targetEventId && f.finished !== false)
      .map((f) => f.event),
  );
  const seasonGamesPlayed = completedEvents.size > 0
    ? completedEvents.size
    : Math.max(1, targetEventId - 1);

  // ── 4b. Per-team games played ─────────────────────────────────────────────
  const teamGamesPlayedMap = {};
  players.forEach((p) => {
    const tid = p.team;
    const s = parseFloat(p.starts) || 0;
    if (s > (teamGamesPlayedMap[tid] || 0)) {
      teamGamesPlayedMap[tid] = s;
    }
  });
  Object.keys(teamPlayerMap).forEach((tid) => {
    if (teamGamesPlayedMap[tid] === undefined) teamGamesPlayedMap[tid] = seasonGamesPlayed;
  });

  // ── 5. Enhance all players with form-adjusted stats ───────────────────────
  //    Recalibrate ICT→xG constants from current bootstrap data first, then
  //    inject _form_xg, _form_xa, _form_factor onto each player object.
  //    playerContributionModel and the simulator use these preferentially.
  formModel.calibrateIctConstants(players);
  const formEnhancedPlayers = players.map((p) =>
    formModel.enhancePlayerWithForm(p, teamGamesPlayedMap[p.team] || seasonGamesPlayed),
  );

  // Rebuild team-player map with form-enhanced players
  const formTeamPlayerMap = buildTeamPlayerMap(formEnhancedPlayers);

  // ── 6. Identify gameweek fixtures ─────────────────────────────────────────
  const gwFixtures = fixtures.filter((f) => f.event === targetEventId);

  if (gwFixtures.length === 0) {
    return formEnhancedPlayers.map((p) => ({
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

  // ── 7. Compute per-fixture lambdas, blend with team form, run simulations ─
  const fixtureSimResults = {};
  const teamFixtureMap    = {};

  gwFixtures.forEach((fixture) => {
    // Blended static + dynamic ELO expected goals
    const { homeLambda: eloHome, awayLambda: eloAway } = eloModel.computeExpectedGoalsWithDynamic(
      fixture.team_h,
      fixture.team_a,
      teamRatings,
      dynamicTeamRatings,
    );

    // Blend ELO with recent team form (70% ELO, 30% form)
    const { homeLambda, awayLambda } = teamFormModel.blendLambdas(
      eloHome, eloAway, fixture.team_h, fixture.team_a, teamFormRatings,
    );

    [fixture.team_h, fixture.team_a].forEach((teamId) => {
      if (!teamFixtureMap[teamId]) teamFixtureMap[teamId] = [];
      teamFixtureMap[teamId].push({
        fixtureId:  fixture.id,
        isHome:     teamId === fixture.team_h,
        homeLambda,
        awayLambda,
        homeElo: dynamicTeamRatings[fixture.team_h]?.eloRating ?? null,
        awayElo: dynamicTeamRatings[fixture.team_a]?.eloRating ?? null,
      });
    });

    // Run Monte Carlo simulation using form-enhanced player arrays
    const homeSimPlayers = buildSimulatorPlayers(formTeamPlayerMap[fixture.team_h] || []);
    const awaySimPlayers = buildSimulatorPlayers(formTeamPlayerMap[fixture.team_a] || []);

    fixtureSimResults[fixture.id] = matchSimulator.runSimulations(
      homeLambda,
      awayLambda,
      homeSimPlayers,
      awaySimPlayers,
    );
  });

  // ── 8. Compute per-player predictions ─────────────────────────────────────
  const { meta: calibMeta } = calibrationStore.getState();
  const calibTested = calibMeta.gwsTested && calibMeta.gwsTested.length > 0;
  const calibQuality = calibTested ? 0.10 : 0;

  return formEnhancedPlayers.map((player) => {
    const playerFixtures = teamFixtureMap[player.team] || [];

    if (playerFixtures.length === 0) {
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

    const teamPlayers     = formTeamPlayerMap[player.team] || [];
    const teamGamesPlayed = teamGamesPlayedMap[player.team] || seasonGamesPlayed;

    // Accumulate across fixtures (DGW support)
    let totalPts     = 0;
    let totalGoals   = 0;
    let totalAssists = 0;
    let totalMins    = 0;
    let totalSaves   = 0;
    let maxCS        = 0;
    let maxYellow    = 0;
    let maxRed       = 0;
    let maxBonus     = 0;

    playerFixtures.forEach((fc) => {
      const simResults = fixtureSimResults[fc.fixtureId] || {};
      const pred       = computeFixturePrediction(
        player, fc, teamPlayers, simResults, teamGamesPlayed,
      );

      totalPts     += pred.predictedPoints;
      totalGoals   += pred.expectedGoals;
      totalAssists += pred.expectedAssists;
      totalMins    += pred.expectedMinutes;
      totalSaves   += pred.expectedSaves;
      // Union probability across fixtures
      maxCS     = 1 - (1 - maxCS)     * (1 - pred.cleanSheetProbability);
      maxYellow = 1 - (1 - maxYellow) * (1 - pred.yellowCardProbability);
      maxRed    = 1 - (1 - maxRed)    * (1 - pred.redCardProbability);
      maxBonus  = 1 - (1 - maxBonus)  * (1 - pred.bonusProbability);
    });

    // ── 9. Apply per-position calibration (unless in backtest mode) ────────
    const position = player.element_type;
    const calibratedPts = skipCalibration
      ? totalPts
      : calibrationStore.applyCalibrationForPlayer(totalPts, player);

    // ── 10. Confidence score ───────────────────────────────────────────────
    //    Enhanced: incorporates calibration quality, form data, and data richness.
    const hasXG         = player.expected_goals != null && parseFloat(player.expected_goals) >= 0;
    const hasMins       = (player.minutes || 0) > 45;
    const hasChance     = player.chance_of_playing_next_round != null;
    const hasForm       = (player._form_factor || 0) !== 0;
    const confidence =
      0.25 +
      (hasXG     ? 0.25 : 0) +
      (hasMins   ? 0.20 : 0) +
      (hasChance ? 0.10 : 0) +
      (hasForm   ? 0.10 : 0) +
      calibQuality;

    // ── 11. Floor / ceiling (based on calibrated points) ──────────────────
    const { floor, ceiling } = floorCeiling(calibratedPts);

    return {
      ...player,
      ep_next:                   round2(calibratedPts),
      predicted_points:          round2(calibratedPts),
      expected_goals:            round2(totalGoals),
      expected_assists:          round2(totalAssists),
      clean_sheet_probability:   round2(Math.min(1, maxCS)),
      expected_minutes:          round2(Math.min(90 * playerFixtures.length, totalMins)),
      expected_saves:            round2(totalSaves),
      yellow_card_probability:   round2(Math.min(1, maxYellow)),
      red_card_probability:      round2(Math.min(1, maxRed)),
      bonus_probability:         round2(Math.min(1, maxBonus)),
      confidence_score:          round2(Math.min(1, confidence)),
      floor_points:              floor,
      ceiling_points:            ceiling,
      fixture_count:             playerFixtures.length,
      // Form metadata — useful for debugging / UI display
      form_factor:               round2(player._form_factor || 1.0),
      calibration_applied:       !skipCalibration,
    };
  });
};

module.exports = {
  computePredictions,
  computeFixturePrediction,
};
