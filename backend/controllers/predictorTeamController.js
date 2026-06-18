'use strict';

/**
 * predictorTeamController
 *
 * HTTP handlers for the FPL Predictor's Team API routes:
 *
 *   GET /api/predictor-team/state          — current squad + team metadata
 *   GET /api/predictor-team/recommendations — weekly recommendations
 *   GET /api/predictor-team/history        — historical decisions
 */

const fplModel            = require('../models/fplModel');
const predictorTeamService = require('../models/predictorTeamService');
const teamDecisionEngine  = require('../models/teamDecisionEngine');
const teamStateRepository = require('../models/teamStateRepository');

// ─── GET /api/predictor-team/state ───────────────────────────────────────────

const getTeamState = async (req, res) => {
  try {
    const [bootstrap, fixtures] = await Promise.all([
      fplModel.fetchBootstrapStatic(),
      fplModel.fetchFixtures(),
    ]);

    const state = await predictorTeamService.getOrGeneratePredictorTeam(bootstrap, fixtures);
    res.json(state);
  } catch (err) {
    console.error('[predictorTeamController] getTeamState error:', err);
    res.status(500).json({ error: 'Failed to load predictor team state' });
  }
};

// ─── GET /api/predictor-team/recommendations ─────────────────────────────────

const getRecommendations = async (req, res) => {
  try {
    const [bootstrap, fixtures] = await Promise.all([
      fplModel.fetchBootstrapStatic(),
      fplModel.fetchFixtures(),
    ]);

    const state = await predictorTeamService.getOrGeneratePredictorTeam(bootstrap, fixtures);

    // After GW1 with no APPLICATION_TEAM, recommendations are unavailable
    if (state.source === 'pre_season_no_team_id') {
      return res.json({
        available:   false,
        phase:       state.phase,
        warning:     state.warning,
        gameweek:    state.currentGameweek,
        generatedAt: new Date().toISOString(),
      });
    }

    // Build all-player enriched list for transfer suggestions
    let allPlayers = bootstrap.elements.map(p => ({
      ...p,
      ep_next: parseFloat(p.ep_next) || 0,
    }));
    allPlayers = fplModel.enrichPlayersWithOpponents(
      allPlayers, fixtures, bootstrap.teams, state.currentGameweek,
    );
    try {
      allPlayers = await fplModel.applyPredictionsWithCache(
        allPlayers, fixtures, bootstrap.teams, state.currentGameweek, 'predictor-recs',
      );
    } catch (err) {
      console.warn('[predictorTeamController] Prediction cache unavailable for recs:', err.message);
    }

    const recs = teamDecisionEngine.generateRecommendations(
      state.squad,
      allPlayers,
      state.currentGameweek,
      { bank: state.bank, freeTransfers: state.freeTransfers },
    );

    // Persist recommendation in history (upsert by gameweek)
    const history = teamStateRepository.loadHistory();
    const existingIdx = history.recommendations.findIndex(
      r => r.gameweek === state.currentGameweek,
    );
    if (existingIdx >= 0) {
      history.recommendations[existingIdx] = recs;
    } else {
      history.recommendations.push(recs);
    }
    teamStateRepository.saveHistory(history);

    res.json(recs);
  } catch (err) {
    console.error('[predictorTeamController] getRecommendations error:', err);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
};

// ─── GET /api/predictor-team/history ─────────────────────────────────────────

const getHistory = async (req, res) => {
  try {
    const history = teamStateRepository.loadHistory();
    res.json(history);
  } catch (err) {
    console.error('[predictorTeamController] getHistory error:', err);
    res.status(500).json({ error: 'Failed to load recommendation history' });
  }
};

module.exports = { getTeamState, getRecommendations, getHistory };
