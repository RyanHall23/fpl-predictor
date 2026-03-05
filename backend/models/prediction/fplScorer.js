'use strict';

/**
 * FPL Scoring Engine.
 *
 * Applies the official FPL scoring rules to a set of probability/expectation
 * values and returns an itemised points breakdown plus a total.
 *
 * Official rules implemented:
 *   Playing:
 *     < 60 minutes → 1 pt
 *     ≥ 60 minutes → 2 pts
 *   Goals scored:
 *     GK  → 10   DEF → 6   MID → 5   FWD → 4
 *   Assist → 3 pts
 *   Clean sheet:
 *     GK / DEF → 4   MID → 1   FWD → 0
 *   Saves (GK):  1 pt per 3 saves
 *   Defensive-action bonus: 2 pts per 10 (DEF) / 12 (MID/FWD) actions
 *   Yellow card → −1   Red card → −3
 *   Goals conceded (GK/DEF): −1 per 2 conceded
 *   Bonus points: 1–3 pts
 */

const GK = 1, DEF = 2, MID = 3, FWD = 4;

const GOAL_POINTS = {
  [GK]:  10,
  [DEF]:  6,
  [MID]:  5,
  [FWD]:  4,
};

const CLEAN_SHEET_POINTS = {
  [GK]:  4,
  [DEF]: 4,
  [MID]: 1,
  [FWD]: 0,
};

/**
 * Compute expected FPL points for a player given probability estimates.
 *
 * All inputs are *expected* values (not binary), allowing the engine to
 * operate over continuous probability distributions rather than binary events.
 *
 * @param {Object} player - FPL element (element_type used for position)
 * @param {Object} probs  - Probability / expectation object:
 *   pStart             P(starting XI)
 *   pSubAppearance     P(sub appearance)
 *   p60Plus            P(playing ≥ 60 minutes)
 *   expectedGoals      Expected goals scored
 *   expectedAssists    Expected assists
 *   cleanSheetProb     P(team keeps clean sheet)
 *   expectedSavePoints Expected save points (already converted: floor(saves/3))
 *   pYellowCard        P(yellow card)
 *   pRedCard           P(red card)
 *   pDefensiveBonus    P(reaching defensive-action threshold)
 *   expectedBonus      Expected bonus points (1–3)
 *   goalsConcededLambda Expected goals conceded by the player's team
 *
 * @returns {{
 *   total:              number,
 *   playingTimePoints:  number,
 *   goalPoints:         number,
 *   assistPoints:       number,
 *   csPoints:           number,
 *   savePoints:         number,
 *   defensivePoints:    number,
 *   disciplinePoints:   number,
 *   goalsConcededPoints:number,
 *   bonusPoints:        number,
 *   breakdown:          Object
 * }}
 */
const computeExpectedFPLPoints = (player, probs) => {
  const position = player.element_type;
  const {
    pStart             = 0,
    pSubAppearance     = 0,
    p60Plus            = 0,
    expectedGoals      = 0,
    expectedAssists    = 0,
    cleanSheetProb     = 0,
    expectedSavePoints = 0,   // Already floor(saves/3) from goalkeeper model
    pYellowCard        = 0,
    pRedCard           = 0,
    pDefensiveBonus    = 0,
    expectedBonus      = 0,
    goalsConcededLambda = 0,
  } = probs;

  // ── 1. Playing-time points ────────────────────────────────────────────────
  const pPlay    = Math.min(1, pStart + pSubAppearance);
  const pBelow60 = Math.max(0, pPlay - p60Plus);
  const playingTimePoints = p60Plus * 2 + pBelow60 * 1;

  // ── 2. Goal points ────────────────────────────────────────────────────────
  // expectedGoals already accounts for P(play) — applied upstream in
  // computeFixturePrediction before being passed here.
  const goalPoints = (GOAL_POINTS[position] || 5) * expectedGoals;

  // ── 3. Assist points ──────────────────────────────────────────────────────
  // expectedAssists also pre-scaled by P(play) upstream.
  const assistPoints = 3 * expectedAssists;

  // ── 4. Clean-sheet points ─────────────────────────────────────────────────
  // CS points require 60+ minutes on the pitch
  const csPoints = (CLEAN_SHEET_POINTS[position] || 0) * cleanSheetProb * p60Plus;

  // ── 5. Save points (GK only) ──────────────────────────────────────────────
  // expectedSavePoints is already scaled by minutesFraction upstream;
  // no further pPlay multiplication is needed.
  const savePoints = position === GK ? expectedSavePoints : 0;

  // ── 6. Defensive-contribution bonus (2 pts per threshold) ─────────────────
  const defensivePoints = 2 * pDefensiveBonus * pPlay;

  // ── 7. Discipline (negative) ──────────────────────────────────────────────
  // pYellowCard and pRedCard are already scaled by minutesFraction upstream
  // in computeDisciplineRisk — no further pPlay multiplication needed.
  const disciplinePoints = -(pYellowCard * 1 + pRedCard * 3);

  // ── 8. Goals-conceded penalty (GK / DEF only) ─────────────────────────────
  // FPL rule: −1 per 2 goals conceded.  E[floor(gc/2)] ≈ goalsConcededLambda / 2.
  let goalsConcededPoints = 0;
  if (position === GK || position === DEF) {
    goalsConcededPoints = -0.5 * goalsConcededLambda * p60Plus;
  }

  // ── 9. Bonus points ───────────────────────────────────────────────────────
  // expectedBonus was estimated using minutesFraction-weighted contributions;
  // no additional pPlay scaling is required.
  const bonusPoints = expectedBonus;

  // ── Total ─────────────────────────────────────────────────────────────────
  const total =
    playingTimePoints  +
    goalPoints         +
    assistPoints       +
    csPoints           +
    savePoints         +
    defensivePoints    +
    disciplinePoints   +
    goalsConcededPoints +
    bonusPoints;

  return {
    total: Math.max(0, total),
    playingTimePoints,
    goalPoints,
    assistPoints,
    csPoints,
    savePoints,
    defensivePoints,
    disciplinePoints,
    goalsConcededPoints,
    bonusPoints,
    breakdown: {
      pPlay,
      p60Plus,
      expectedGoals,
      expectedAssists,
      cleanSheetProb,
      expectedSavePoints,
      pYellowCard,
      pRedCard,
      pDefensiveBonus,
      expectedBonus,
      goalsConcededLambda,
    },
  };
};

module.exports = {
  computeExpectedFPLPoints,
  GOAL_POINTS,
  CLEAN_SHEET_POINTS,
  GK, DEF, MID, FWD,
};
