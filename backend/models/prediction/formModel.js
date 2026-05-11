'use strict';

/**
 * Player form model.
 *
 * Computes form-adjusted attacking statistics by blending:
 *   - Season cumulative stats (xG, xA per game) — stable long-run signal
 *   - ICT threat/creativity   — rolling form signal for recent goal/assist threat
 *   - FPL `form` field        — 5-game rolling points average
 *   - Transfer market signals — manager sentiment on player's upcoming potential
 *   - Differential xG        — regression-to-mean when goals under/over-perform xG
 *
 * Form-adjusted values are injected back onto the player object so every
 * downstream model (playerContributionModel, minutesModel, bonusModel, etc.)
 * automatically benefits without knowing about the form layer.
 */

const num = (v) => {
  if (v == null) return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * How many games FPL's rolling ICT / form values cover.
 * FPL uses approximately a 5-game window for `form` and the ICT fields.
 */
const ICT_ROLLING_WINDOW = 5;

/**
 * Rough calibration: typical threat units per goal threat.
 * EPL forwards average ~0.3 xG/game and ~25 threat/game → ~83 threat per xG.
 * Using 80 as a round calibration constant gives:
 *   threatPerGame / 80 ≈ xG per game
 *
 * These constants can be dynamically recalibrated from bootstrap data via
 * `calibrateIctConstants(players)` — call once per request cycle.
 *
 * Fixed priors are kept separately so that the 30% blend in
 * `calibrateIctConstants` always pulls toward the original domain knowledge
 * rather than the previously-derived value, preventing cumulative drift across
 * repeated calls.
 */
const THREAT_PER_XG_PRIOR     = 80;
const CREATIVITY_PER_XA_PRIOR = 100;
let THREAT_PER_XG        = THREAT_PER_XG_PRIOR;
let CREATIVITY_PER_XA    = CREATIVITY_PER_XA_PRIOR;

/**
 * Recalibrate ICT conversion constants from the current season's player data.
 *
 * Computes the season-aggregate ratio of (total threat / total xG) and
 * (total creativity / total xA) across all players with sufficient data,
 * then blends 70% season-derived with 30% prior to avoid over-fitting to
 * early-season noise.
 *
 * Should be called once per request cycle (fplModel.applyAdvancedPredictions)
 * after bootstrap data is loaded.
 *
 * @param {Array} players - FPL bootstrap-static players array
 */
const calibrateIctConstants = (players) => {
  let sumThreat = 0, sumXg = 0;
  let sumCreativity = 0, sumXa = 0;

  players.forEach((p) => {
    const xg = num(p.expected_goals);
    const xa = num(p.expected_assists);
    const threat     = num(p.threat);
    const creativity = num(p.creativity);
    // Only include players with meaningful data to avoid noise
    if (xg >= 0.5 && threat > 0)     { sumThreat     += threat;     sumXg += xg; }
    if (xa >= 0.5 && creativity > 0) { sumCreativity += creativity; sumXa += xa; }
  });

  if (sumXg > 5) {
    const derived = sumThreat / sumXg;
    THREAT_PER_XG = 0.70 * derived + 0.30 * THREAT_PER_XG_PRIOR;
  }
  if (sumXa > 5) {
    const derived = sumCreativity / sumXa;
    CREATIVITY_PER_XA = 0.70 * derived + 0.30 * CREATIVITY_PER_XA_PRIOR;
  }
};

/**
 * Blend weights: season stats vs form signals.
 *   0.55 recent / 0.45 season gives meaningful responsiveness
 *   without over-reacting to single hot/cold streaks.
 */
const FORM_WEIGHT   = 0.55;
const SEASON_WEIGHT = 0.45;

/**
 * Maximum form multiplier to prevent extreme adjustments.
 * Caps at ±40% relative to season baseline.
 */
const FORM_FACTOR_MIN = 0.60;
const FORM_FACTOR_MAX = 1.50;

/**
 * Transfer market sentiment scaling.
 * Heavy net buying (e.g. 100k+ in) → small confidence boost.
 * Heavy net selling (e.g. 100k+ out) → small confidence reduction.
 */
const TRANSFER_DELTA_SCALE = 500_000; // normaliser (net transfers)

/**
 * Differential xG regression weight.
 * A player with xG >> goals is "due" goals; a player with goals >> xG
 * benefited from high conversion.  We lightly regress predictions toward xG.
 */
const XG_REGRESSION_WEIGHT = 0.15;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Compute form factor: ratio of recent form to season average PPG.
 * Captures whether a player is currently in better or worse form than
 * their seasonal baseline.
 *
 * @param {Object} player
 * @returns {number} Form factor in [FORM_FACTOR_MIN, FORM_FACTOR_MAX]
 */
const computeFormFactor = (player) => {
  const form      = num(player.form);          // 5-game rolling avg points
  const ppg       = num(player.points_per_game); // season average

  if (ppg < 0.5) {
    // Early season / rarely plays — use form directly as a quality signal
    if (form > 0) return Math.min(FORM_FACTOR_MAX, 0.8 + form / 10);
    return 1.0;
  }

  const rawRatio  = form / ppg;
  return Math.min(FORM_FACTOR_MAX, Math.max(FORM_FACTOR_MIN, rawRatio));
};

/**
 * Compute recent xG per game from FPL's rolling `threat` metric.
 *
 * @param {Object} player
 * @returns {number} Recent xG per game estimate
 */
const ictXgPerGame = (player) => {
  const threatPerGame = num(player.threat) / ICT_ROLLING_WINDOW;
  return threatPerGame / THREAT_PER_XG;
};

/**
 * Compute recent xA per game from FPL's rolling `creativity` metric.
 *
 * @param {Object} player
 * @returns {number} Recent xA per game estimate
 */
const ictXaPerGame = (player) => {
  const creativityPerGame = num(player.creativity) / ICT_ROLLING_WINDOW;
  return creativityPerGame / CREATIVITY_PER_XA;
};

/**
 * Compute differential xG adjustment.
 * When a player's season goals under/over-perform their xG, regress slightly
 * back toward xG to correct for luck-driven variance.
 *
 * Returns a small additive correction (positive = boost, negative = reduction).
 *
 * @param {Object} player
 * @param {number} seasonGamesPlayed
 * @returns {number} xG correction per game
 */
const xgDifferentialCorrection = (player, seasonGamesPlayed) => {
  const games   = Math.max(1, seasonGamesPlayed);
  const xGTotal = num(player.expected_goals);
  const goals   = num(player.goals_scored);

  if (xGTotal < 0.5) return 0; // Insufficient data

  // Positive = player has underperformed xG (due extra goals), negative = overperformed
  const differential = (xGTotal - goals) / games; // per game
  return differential * XG_REGRESSION_WEIGHT;
};

/**
 * Transfer market sentiment signal.
 * Heavy net buying from managers signals upcoming upside; net selling signals
 * rotation risk, upcoming blank, or loss of form confidence.
 *
 * Returns a small multiplier adjustment in [-0.05, +0.05].
 *
 * @param {Object} player
 * @returns {number} Sentiment adjustment
 */
const transferSentiment = (player) => {
  const netTransfers = num(player.transfers_in_event) - num(player.transfers_out_event);
  // Normalise to [-0.05, +0.05] range
  return Math.max(-0.05, Math.min(0.05, netTransfers / TRANSFER_DELTA_SCALE));
};

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Compute form-adjusted xG and xA per game for a player.
 *
 * @param {Object} player             - FPL element from bootstrap-static
 * @param {number} seasonGamesPlayed  - Number of GWs completed
 * @returns {{
 *   formXgPerGame:  number,   Form-adjusted xG per game
 *   formXaPerGame:  number,   Form-adjusted xA per game
 *   formFactor:     number,   Overall form multiplier (1.0 = average)
 *   formPPG:        number,   Rolling 5-game average points
 *   sentimentAdj:   number,   Transfer market adjustment
 * }}
 */
const computeFormStats = (player, seasonGamesPlayed) => {
  const games = Math.max(1, seasonGamesPlayed);

  // Season per-game rates
  const seasonXgPerGame = num(player.expected_goals)  / games;
  const seasonXaPerGame = num(player.expected_assists) / games;

  // Recent ICT-based per-game rates
  const recentXgPerGame = ictXgPerGame(player);
  const recentXaPerGame = ictXaPerGame(player);

  // Overall form factor (recent vs season)
  const formFactor = computeFormFactor(player);

  // Blended per-game rates: season + ICT + form factor
  const rawBlendedXg = SEASON_WEIGHT * seasonXgPerGame + FORM_WEIGHT * recentXgPerGame;
  const rawBlendedXa = SEASON_WEIGHT * seasonXaPerGame + FORM_WEIGHT * recentXaPerGame;

  // Apply form factor to the blended rates
  const formAdjXg = rawBlendedXg * formFactor;
  const formAdjXa = rawBlendedXa * formFactor;

  // Apply xG differential regression (small correction)
  const xgCorr = xgDifferentialCorrection(player, games);

  // Transfer market sentiment
  const sentimentAdj = transferSentiment(player);

  return {
    formXgPerGame: Math.max(0, formAdjXg + xgCorr + sentimentAdj * seasonXgPerGame),
    formXaPerGame: Math.max(0, formAdjXa + sentimentAdj * seasonXaPerGame),
    formFactor,
    formPPG:       num(player.form),
    sentimentAdj,
  };
};

/**
 * Enhance a player object with form-adjusted season totals.
 *
 * Injects `_form_xg` and `_form_xa` fields representing the per-game
 * form-adjusted values, scaled back to season-total units for compatibility
 * with `attackingInvolvementScore`.  Downstream models that check for these
 * private fields will use them in preference to raw season totals.
 *
 * The original `expected_goals` / `expected_assists` fields are not mutated;
 * the form fields are additive private overrides.
 *
 * @param {Object} player            - FPL element
 * @param {number} seasonGamesPlayed - Completed GW count
 * @returns {Object} Augmented player (new object, original unchanged)
 */
const enhancePlayerWithForm = (player, seasonGamesPlayed) => {
  const games = Math.max(1, seasonGamesPlayed);
  const stats = computeFormStats(player, games);

  return {
    ...player,
    // Form-adjusted "season totals" (per-game × games, so same scale as raw xG/xA)
    _form_xg:     stats.formXgPerGame * games,
    _form_xa:     stats.formXaPerGame * games,
    _form_factor: stats.formFactor,
    _form_ppg:    stats.formPPG,
    _sentiment:   stats.sentimentAdj,
  };
};

module.exports = {
  computeFormStats,
  enhancePlayerWithForm,
  calibrateIctConstants,
  FORM_WEIGHT,
  SEASON_WEIGHT,
};
