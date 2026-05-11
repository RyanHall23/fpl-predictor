'use strict';

/**
 * Dynamic team form model.
 *
 * Analyses recently completed EPL fixtures to compute each team's current
 * attacking and defensive form, then produces blended lambda (expected-goals)
 * values that combine ELO-based long-run strength with short-term form.
 *
 * This captures momentum effects that static ELO ratings miss:
 *   - A striker-less team on a poor run will have a lower attack multiplier
 *   - A newly-solid defence will show a lower goals-conceded multiplier
 *
 * Algorithm:
 *   1. Identify the last RECENT_N completed fixtures for each team
 *   2. Compute weighted average goals scored / conceded (exponential decay)
 *   3. Express as a multiplier relative to the EPL average (1.35 g/g)
 *   4. Blend ELO lambda with form lambda: ELO_WEIGHT × elo + FORM_WEIGHT × form
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/** Number of recent fixtures to consider per team */
const RECENT_N = 5;

/** EPL long-run average goals per team per game */
const EPL_AVERAGE_GOALS = 1.35;

/**
 * Exponential decay factor for recency weighting.
 * 0.75 means the most recent game has ~3× the weight of a game 5 rounds ago.
 *   weights = [0.75^0, 0.75^1, ..., 0.75^(N-1)] normalised to sum = 1
 */
const DECAY_FACTOR = 0.75;

/** How much ELO vs recent form influence the final lambda. */
const ELO_WEIGHT  = 0.70;
const FORM_WEIGHT = 0.30;

/**
 * Minimum completed games before form data is trusted.
 * Below this threshold we fall back to pure ELO.
 */
const MIN_GAMES_FOR_FORM = 2;

/** Clamp multipliers to prevent extreme outliers from destabilising lambdas */
const MULTIPLIER_MIN = 0.45;
const MULTIPLIER_MAX = 2.50;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build exponential-decay weights for n items (index 0 = most recent).
 * @param {number} n
 * @returns {number[]} Normalised weights summing to 1.0
 */
const buildWeights = (n) => {
  const raw = Array.from({ length: n }, (_, i) => Math.pow(DECAY_FACTOR, i));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => w / sum);
};

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Build per-team recent-form ratings from the completed fixtures array.
 *
 * @param {Array} fixtures - Full FPL fixtures array (may include future fixtures)
 * @returns {Object} Map: teamId → {
 *   attackMultiplier  - ratio of recent goals scored vs EPL average
 *   defenseMultiplier - ratio of recent goals conceded vs EPL average (higher = weaker defence)
 *   recentAvgScored
 *   recentAvgConceded
 *   gamesAnalyzed
 * }
 */
const buildTeamFormRatings = (fixtures) => {
  // Only fixtures with confirmed scores
  const completed = fixtures.filter(
    (f) =>
      f.finished === true &&
      f.team_h_score != null &&
      f.team_a_score != null &&
      f.event != null,
  );

  if (completed.length === 0) return {};

  // Build per-team fixture list: { event, scored, conceded }
  const teamFixtures = {}; // teamId → Array<{ event, scored, conceded }>

  completed.forEach((f) => {
    const h = f.team_h;
    const a = f.team_a;
    const hg = Number(f.team_h_score);
    const ag = Number(f.team_a_score);

    if (!teamFixtures[h]) teamFixtures[h] = [];
    if (!teamFixtures[a]) teamFixtures[a] = [];

    teamFixtures[h].push({ event: f.event, scored: hg, conceded: ag });
    teamFixtures[a].push({ event: f.event, scored: ag, conceded: hg });
  });

  const result = {};

  Object.entries(teamFixtures).forEach(([teamId, games]) => {
    // Sort descending by event (most recent first) and take RECENT_N
    const sorted = [...games].sort((a, b) => b.event - a.event).slice(0, RECENT_N);
    const n = sorted.length;

    if (n < MIN_GAMES_FOR_FORM) {
      result[teamId] = {
        attackMultiplier:  1.0,
        defenseMultiplier: 1.0,
        recentAvgScored:   EPL_AVERAGE_GOALS,
        recentAvgConceded: EPL_AVERAGE_GOALS,
        gamesAnalyzed: n,
      };
      return;
    }

    const weights = buildWeights(n);
    const avgScored   = sorted.reduce((s, g, i) => s + g.scored   * weights[i], 0);
    const avgConceded = sorted.reduce((s, g, i) => s + g.conceded * weights[i], 0);

    // xG regression: regress recent raw goals toward the team's own longer-run
    // mean to dampen variance from lucky/unlucky short streaks.
    // We use the full (unsliced) sample as the longer-run anchor.
    const allGames = games; // all completed fixtures for this team
    const fullAvgScored   = allGames.length >= RECENT_N
      ? allGames.reduce((s, g) => s + g.scored,   0) / allGames.length
      : avgScored;
    const fullAvgConceded = allGames.length >= RECENT_N
      ? allGames.reduce((s, g) => s + g.conceded, 0) / allGames.length
      : avgConceded;

    // Regression weight: how much to pull toward the longer-run mean.
    // Higher when the recent sample is small (more uncertain).
    const regressionWeight = Math.max(0, Math.min(0.25, 1 - n / (RECENT_N * 2)));
    const regressedScored   = avgScored   * (1 - regressionWeight) + fullAvgScored   * regressionWeight;
    const regressedConceded = avgConceded * (1 - regressionWeight) + fullAvgConceded * regressionWeight;

    result[teamId] = {
      attackMultiplier:  Math.min(MULTIPLIER_MAX, Math.max(MULTIPLIER_MIN, regressedScored   / EPL_AVERAGE_GOALS)),
      defenseMultiplier: Math.min(MULTIPLIER_MAX, Math.max(MULTIPLIER_MIN, regressedConceded / EPL_AVERAGE_GOALS)),
      recentAvgScored:   regressedScored,
      recentAvgConceded: regressedConceded,
      gamesAnalyzed: n,
    };
  });

  return result;
};

/**
 * Blend ELO-derived expected-goals lambdas with team form multipliers.
 *
 * When form data is sparse (< MIN_GAMES_FOR_FORM completed games) for either
 * team, returns the pure ELO estimates unchanged.
 *
 * @param {number} eloHomeLambda - ELO home team xG
 * @param {number} eloAwayLambda - ELO away team xG
 * @param {number} homeTeamId
 * @param {number} awayTeamId
 * @param {Object} formRatings   - Output of buildTeamFormRatings()
 * @returns {{ homeLambda: number, awayLambda: number }}
 */
const blendLambdas = (eloHomeLambda, eloAwayLambda, homeTeamId, awayTeamId, formRatings) => {
  const homeForm = formRatings[homeTeamId];
  const awayForm = formRatings[awayTeamId];

  // Fall back to ELO only when insufficient form data
  if (
    !homeForm || !awayForm ||
    homeForm.gamesAnalyzed < MIN_GAMES_FOR_FORM ||
    awayForm.gamesAnalyzed < MIN_GAMES_FOR_FORM
  ) {
    return { homeLambda: eloHomeLambda, awayLambda: eloAwayLambda };
  }

  // Form-adjusted lambdas use both teams' recent form:
  //   home attack form × away defensive weakness
  //   away attack form × home defensive weakness
  const formHomeLambda =
    eloHomeLambda *
    (homeForm.attackMultiplier * 0.55 + awayForm.defenseMultiplier * 0.45);

  const formAwayLambda =
    eloAwayLambda *
    (awayForm.attackMultiplier * 0.55 + homeForm.defenseMultiplier * 0.45);

  return {
    homeLambda: ELO_WEIGHT * eloHomeLambda + FORM_WEIGHT * formHomeLambda,
    awayLambda: ELO_WEIGHT * eloAwayLambda + FORM_WEIGHT * formAwayLambda,
  };
};

module.exports = {
  buildTeamFormRatings,
  blendLambdas,
  EPL_AVERAGE_GOALS,
};
