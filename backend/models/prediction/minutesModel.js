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
 * Data sources used (all available from FPL bootstrap-static):
 *   - chance_of_playing_next_round (0–100 or null → assume fit)
 *   - minutes  (season total)
 *   - starts   (if available)
 */

const num = (v) => {
  if (v == null) return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Estimate per-game average minutes from season totals.
 * Falls back to a position-based heuristic when starts data is absent.
 *
 * @param {Object} player - FPL element
 * @returns {number} Average minutes per appearance (0–90)
 */
const avgMinutesPerGame = (player) => {
  const totalMins = num(player.minutes);
  const starts = num(player.starts);

  if (starts > 0) {
    // starts field is reliable — use it
    return Math.min(90, totalMins / starts);
  }

  // Estimate number of appearances from total points as a rough proxy
  const totalPts = num(player.total_points);
  const estimatedApps = Math.max(1, totalPts / 4); // ~4 pts per game average
  return Math.min(90, totalMins / estimatedApps);
};

/**
 * Derive playing-time probabilities for a player.
 *
 * @param {Object} player - FPL element from bootstrap-static
 * @returns {{
 *   pStart: number,
 *   pSubAppearance: number,
 *   p60Plus: number,
 *   expectedMinutes: number
 * }}
 */
const estimateMinutesProbabilities = (player) => {
  // ── 1. Injury / availability adjustment ──────────────────────────────────
  const chanceOfPlaying =
    player.chance_of_playing_next_round != null
      ? num(player.chance_of_playing_next_round) / 100
      : 1.0;

  if (chanceOfPlaying <= 0.05) {
    return { pStart: 0, pSubAppearance: 0, p60Plus: 0, expectedMinutes: 0 };
  }

  // ── 2. Base probabilities from recent minutes history ────────────────────
  const avgMins = avgMinutesPerGame(player);

  let pStart, pSubAppearance, p60Plus;

  if (avgMins >= 78) {
    // Reliable starter who rarely gets subbed
    pStart = 0.88;
    pSubAppearance = 0.04;
    p60Plus = 0.82;
  } else if (avgMins >= 62) {
    // Regular starter, occasionally subbed off before 60
    pStart = 0.78;
    pSubAppearance = 0.07;
    p60Plus = 0.65;
  } else if (avgMins >= 45) {
    // Rotation or frequent early substitution
    pStart = 0.62;
    pSubAppearance = 0.12;
    p60Plus = 0.45;
  } else if (avgMins >= 25) {
    // Impact substitute / heavily rotated
    pStart = 0.38;
    pSubAppearance = 0.28;
    p60Plus = 0.18;
  } else if (avgMins >= 8) {
    // Fringe player, rare appearances
    pStart = 0.15;
    pSubAppearance = 0.25;
    p60Plus = 0.06;
  } else {
    // Rarely features
    pStart = 0.05;
    pSubAppearance = 0.10;
    p60Plus = 0.02;
  }

  // ── 3. Apply injury / availability scale ─────────────────────────────────
  pStart         *= chanceOfPlaying;
  pSubAppearance *= chanceOfPlaying;
  p60Plus        *= chanceOfPlaying;

  // ── 4. Expected minutes ──────────────────────────────────────────────────
  // Starters contribute ~avgMins, subs contribute roughly 20–30 mins
  const subMins = Math.min(30, avgMins * 0.35);
  const expectedMinutes = pStart * avgMins + pSubAppearance * subMins;

  return {
    pStart:          Math.min(1, Math.max(0, pStart)),
    pSubAppearance:  Math.min(1, Math.max(0, pSubAppearance)),
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
  avgMinutesPerGame,
};
