const express = require('express');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const fplController = require('./controllers/fplController');
const assistantController = require('./controllers/assistantController');
const espnController = require('./controllers/espnController');
const predictorTeamController = require('./controllers/predictorTeamController');
const authRoutes = require('./routes/auth');
const { apiLimiter } = require('./middleware/rateLimiter');
const { withCacheHeaders } = require('./utils/cacheHeaders');
const app = express();
const port = process.env.PORT || 5000;

const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
};
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json());

// FPL API proxy routes
app.get('/api/bootstrap-static', apiLimiter, withCacheHeaders(300, 60), fplController.getBootstrapStatic);
app.get('/api/bootstrap-static/forecast', apiLimiter, withCacheHeaders(300, 60), fplController.getPlayersForecast);
app.get('/api/bootstrap-static/enriched', apiLimiter, withCacheHeaders(300, 60), fplController.getAllPlayersEnriched);
app.get('/api/fixtures', apiLimiter, withCacheHeaders(600, 120), fplController.getFixtures);
app.get('/api/element-summary/:playerId', apiLimiter, withCacheHeaders(120), fplController.getElementSummary);
app.get('/api/event/:eventId/live', apiLimiter, fplController.getLiveGameweek);
app.get('/api/predicted-team', apiLimiter, withCacheHeaders(300, 60), fplController.getPredictedTeam);
app.get('/api/entry/:entryId/team', apiLimiter, fplController.getUserTeamForEntry);
app.get('/api/entry/:entryId/event/:eventId/team', apiLimiter, fplController.getUserTeam);
app.get('/api/entry/:entryId/profile', apiLimiter, fplController.getUserProfile);
app.get('/api/entry/:entryId/bench-points-missed', apiLimiter, fplController.getBenchPointsMissed);
app.get('/api/leagues-classic/:leagueId/standings', apiLimiter, withCacheHeaders(60, 30), fplController.getLeagueStandings);
app.get('/api/leagues-classic/:leagueId/race', apiLimiter, withCacheHeaders(300, 60), fplController.getLeagueRace);
app.get('/api/entry/:entryId/event/:eventId/recommended-transfers', apiLimiter, withCacheHeaders(120, 60), fplController.getRecommendedTransfers);
app.get('/api/entry/:entryId/transfers', apiLimiter, fplController.getEntryTransfers);
app.get('/api/entry/:entryId/transfer-insights', apiLimiter, fplController.getTransferInsights);
app.post('/api/validate-swap', apiLimiter, fplController.validateSwap);
app.post('/api/available-transfers/:playerCode', apiLimiter, fplController.getAvailableTransfers);

// Assistant Manager hints
// NOTE: /general must be registered before /:entryId to avoid route shadowing
app.get('/api/assistant/general', apiLimiter, withCacheHeaders(120, 60), assistantController.getAssistantHints);
app.get('/api/assistant/:entryId', apiLimiter, withCacheHeaders(120, 60), assistantController.getAssistantHints);

// ESPN API proxy routes — browser never calls ESPN directly
app.get('/api/espn/scoreboard', apiLimiter, espnController.getScoreboard);
app.get('/api/espn/summary/:eventId', apiLimiter, espnController.getSummary);

// Auth routes (user registration, login, profile management)
app.use('/api/auth', authRoutes);

// FPL Predictor's Team routes
app.get('/api/predictor-team/state', apiLimiter, predictorTeamController.getTeamState);
app.get('/api/predictor-team/recommendations', apiLimiter, predictorTeamController.getRecommendations);
app.get('/api/predictor-team/history', apiLimiter, predictorTeamController.getHistory);

// Serve built Vite frontend from the same process
const distPath = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('/*splat', apiLimiter, (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Export for Vercel serverless; also start listening for local/traditional deployments
module.exports = app;

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Proxy server running on port ${port}`);
  });
}
