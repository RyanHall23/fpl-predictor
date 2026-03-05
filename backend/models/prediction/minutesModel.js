'use strict';

/**
 * Expected-minutes / lineup prediction model.
 *
 * Estimates the probability that a player will:
 *   - Start the match           (pStart)
 *   - Appear as a substitute    (pSubAppearance)
 *   - Play 60 or more minutes   (p60Plus)
 *
 * Playing-time probabilities directly affect every FPL scoring component.
 *
 * The two key dimensions are modelled independently:
 *   1. Start frequency  — how often the player starts (starts / season games played)
 *   2. Playing duration — how long they last when they do play (avg mins / game)
 *
 * This correctly distinguishes a backup keeper with 3 starts in 24 games
 * (pStart ≈ 0.13) from a first-choice keeper with 24 starts (pStart ≈ 1.0),
 * even though both may average 90 minutes per start.
 *
 * Data sources (all from FPL bootstrap-static):
 *   - chance_of_playing_next_round (0–100 or null → assume fit)
 *   - minutes  (season total)
 *   - starts   (season total starts in starting XI)
 *   - seasonGamesPlayed (passed from engine: games completed so far)
 */

// ── Named constants ────────────────────────────────────────────────────────

/**
 * Assumed average minutes per appearance when the starts field is absent.
 * 70 is a conservative midpoint — a substitute plays ~20–30 mins, a starter
 * plays ~80–90 mins, and many players fall somewhere between.
 */
const ESTIMATED_MINS_PER_APPEARANCE = 70;

/**
 * Fraction of non-starting games where a high-minute player (avg ≥ 60 mins/start)
 * comes on as a substitute.  High-minute players are usually first-choice and
 * rarely sit on the bench, so their sub rate is low.
 */
const SUB_FRACTION_HIGH_MINUTES = 0.15;

/**
 * Fraction of non-starting games where a low-minute player (avg < 60 mins/start)
 * comes on as a substitute.  These players are more likely to be used as
 * impact subs, giving a higher bench-to-pitch conversion rate.
 */
const SUB_FRACTION_LOW_MINUTES = 0.28;

/**
 * Expected minutes for a substitute appearance.
 * EPL substitutes typically come on around the 60th–70th minute,
 * yielding roughly 20–30 minutes of play.
 */
const AVG_SUB_MINUTES = 22;

const num = (v) => {
  if (v == null) return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Estimate average minutes per START (not per game — only when selected).
 * This tells us how long the player lasts when they are picked, independent
 * of how frequently they are picked.
 *
 * @param {Object} player - FPL element
 * @returns {number} Average minutes per start (0–90)
 */
const avgMinutesPerStart = (player) => {
  const totalMins = num(player.minutes);
  const starts    = num(player.starts);

  if (starts > 0) {
    return Math.min(90, totalMins / starts);
  }

  // Fallback when starts field is absent
  const totalPts      = num(player.total_points);
  const estimatedApps = Math.max(1, totalPts / 4);
  return Math.min(90, totalMins / estimatedApps);
};

/**
 * Derive playing-time probabilities for a player.
 *
 * @param {Object} player              - FPL element from bootstrap-static
 * @param {number} [seasonGamesPlayed] - Games completed in the season so far.
 *   When provided, P(start) is computed from the player's actual start rate
 *   (starts / seasonGamesPlayed), which correctly differentiates first-choice
 *   players from backup / fringe players who may average 90 mins per start
 *   but rarely get selected.  Defaults to 20 when unknown.
 * @returns {{
 *   pStart: number,
 *   pSubAppearance: number,
 *   p60Plus: number,
 *   expectedMinutes: number
 * }}
 */
const estimateMinutesProbabilities = (player, seasonGamesPlayed = 20) => {
  // ── 1. Injury / availability adjustment ──────────────────────────────────
  const chanceOfPlaying =
    player.chance_of_playing_next_round != null
      ? num(player.chance_of_playing_next_round) / 100
      : 1.0;

  if (chanceOfPlaying <= 0.05) {
    return { pStart: 0, pSubAppearance: 0, p60Plus: 0, expectedMinutes: 0 };
  }

  // ── 2. Start rate — how often this player actually starts ─────────────────
  //
  // This is the primary signal for P(start) and directly addresses the
  // Trafford vs Donnarumma situation: both may average 90 mins per start,
  // but Trafford starting 3/24 games vs Donnarumma starting 24/24 games
  // should yield very different starting probabilities.
  const starts          = num(player.starts);
  const totalMins       = num(player.minutes);
  const gamesPlayed     = Math.max(1, seasonGamesPlayed);

  let historicalStartRate;

  if (starts > 0) {
    // Reliable: directly use starts/gamesPlayed
    historicalStartRate = Math.min(1, starts / gamesPlayed);
  } else if (totalMins > 0) {
    // starts field absent — estimate from minutes
    const estimatedStarts = totalMins / ESTIMATED_MINS_PER_APPEARANCE;
    historicalStartRate   = Math.min(1, estimatedStarts / gamesPlayed);
  } else {
    // No data — conservative estimate (new/uncapped player)
    historicalStartRate = 0.10;
  }

  // ── 3. Playing duration — how long they last per start ───────────────────
  //
  // Separate from start frequency: this governs P(60+) and expected minutes
  // conditional on actually being selected.
  const avgMinsPerStart = avgMinutesPerStart(player);

  // P(60+ minutes | started)
  let p60PlusGivenStart;
  if (avgMinsPerStart >= 82) {
    p60PlusGivenStart = 0.92;
  } else if (avgMinsPerStart >= 70) {
    p60PlusGivenStart = 0.76;
  } else if (avgMinsPerStart >= 58) {
    p60PlusGivenStart = 0.56;
  } else if (avgMinsPerStart >= 42) {
    p60PlusGivenStart = 0.35;
  } else {
    p60PlusGivenStart = 0.15;
  }

  // ── 4. Sub-appearance probability ────────────────────────────────────────
  //
  // Players who rarely start still appear as substitutes.  The complement
  // of the start rate (available but not selected) is split between bench
  // and not being in the squad at all.  We approximate: players with a low
  // start rate but solid appearances have a meaningful sub probability.
  const nonStartRate = Math.max(0, 1 - historicalStartRate);
  const subFraction = avgMinsPerStart >= 60 ? SUB_FRACTION_HIGH_MINUTES : SUB_FRACTION_LOW_MINUTES;
  const pSubAppearance = nonStartRate * subFraction;

  // ── 5. Compose final probabilities ───────────────────────────────────────
  let pStart = historicalStartRate;

  // p60Plus requires being started AND lasting 60+ mins
  // (substitutes coming on late very rarely reach 60 minutes)
  let p60Plus = pStart * p60PlusGivenStart;

  // ── 6. Apply injury / availability scale ─────────────────────────────────
  pStart         *= chanceOfPlaying;
  const pSubApp   = pSubAppearance * chanceOfPlaying;
  p60Plus        *= chanceOfPlaying;

  // ── 7. Expected minutes ──────────────────────────────────────────────────
  const expectedMinutes = pStart * avgMinsPerStart + pSubApp * AVG_SUB_MINUTES;

  return {
    pStart:          Math.min(1, Math.max(0, pStart)),
    pSubAppearance:  Math.min(1, Math.max(0, pSubApp)),
    p60Plus:         Math.min(1, Math.max(0, p60Plus)),
    expectedMinutes: Math.min(90, Math.max(0, expectedMinutes)),
  };
};

/**
 * Expected FPL playing-time points.
 * FPL rules: up to 60 minutes → 1 pt; 60+ minutes → 2 pts.
 *
 * @param {number} p60Plus        - P(playing 60+ minutes)
 * @param {number} pStart         - P(starting)
 * @param {number} pSubAppearance - P(sub appearance)
 * @returns {number} Expected playing-time points
 */
const expectedPlayingTimePoints = (p60Plus, pStart, pSubAppearance) => {
  const pPlay   = Math.min(1, pStart + pSubAppearance);
  const pBelow60 = Math.max(0, pPlay - p60Plus);
  return p60Plus * 2 + pBelow60 * 1;
};

module.exports = {
  estimateMinutesProbabilities,
  expectedPlayingTimePoints,
  avgMinutesPerStart,
  ESTIMATED_MINS_PER_APPEARANCE,
  SUB_FRACTION_HIGH_MINUTES,
  SUB_FRACTION_LOW_MINUTES,
  AVG_SUB_MINUTES,
};

