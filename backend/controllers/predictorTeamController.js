'use strict';

/**
 * Predictor Team Controller
 *
 * HTTP handlers for the FPL Predictor's managed team feature.
 *
 * Routes:
 *   GET /api/predictor-team/status           — current squad + phase info
 *   GET /api/predictor-team/recommendations  — transfer / captain / lineup recs
 *   GET /api/predictor-team/history          — historical decisions
 */

const predictorTeamService = require('../models/predictorTeamService');
const teamStateRepository  = require('../models/teamStateRepository');

/**
 * GET /api/predictor-team/status
 *
 * Returns the current predictor team state including squad, bank, rank, and
 * season-phase metadata.  This endpoint generates (and caches) the pre-season
 * squad on first call.
 */
const getStatus = async (req, res) => {
  try {
    const status = await predictorTeamService.getPredictorTeamStatus();
    // Strip internal enriched-player keys before sending to the client
    const { _enrichedSquad, _enrichedPlayers, ...clientStatus } = status;
    res.json(clientStatus);
  } catch (err) {
    console.error('[predictorTeamController] getStatus error:', err);
    res.status(500).json({ error: 'Failed to load predictor team status.' });
  }
};

/**
 * GET /api/predictor-team/recommendations
 *
 * Returns recommended transfers, captain, lineup, bench order, and chip
 * suggestion for the next gameweek.
 */
const getRecommendations = async (req, res) => {
  try {
    const recs = await predictorTeamService.getPredictorTeamRecommendations();
    res.json(recs);
  } catch (err) {
    console.error('[predictorTeamController] getRecommendations error:', err);
    res.status(500).json({ error: 'Failed to generate predictor team recommendations.' });
  }
};

/**
 * GET /api/predictor-team/history
 *
 * Returns the full recommendation history with predicted vs actual points.
 */
const getHistory = async (req, res) => {
  try {
    const history = teamStateRepository.loadDecisionHistory();
    res.json(history);
  } catch (err) {
    console.error('[predictorTeamController] getHistory error:', err);
    res.status(500).json({ error: 'Failed to load predictor team history.' });
  }
};

module.exports = { getStatus, getRecommendations, getHistory };
