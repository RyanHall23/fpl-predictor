const express = require('express');
const cors = require('cors');
const fplController = require('./controllers/fplController');
const { apiLimiter, dbReadLimiter } = require('./middleware/rateLimiter');
const app = express();
const port = process.env.PORT || 5000;

const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
};
app.use(cors(corsOptions));
app.use(express.json());

// FPL API proxy routes
app.get('/api/bootstrap-static', apiLimiter, fplController.getBootstrapStatic);
app.get('/api/bootstrap-static/enriched', apiLimiter, fplController.getAllPlayersEnriched);
app.get('/api/entry/:entryId/event/:eventId/picks', apiLimiter, fplController.getPlayerPicks);
app.get('/api/element-summary/:playerId', apiLimiter, fplController.getElementSummary);
app.get('/api/event/:eventId/live', apiLimiter, fplController.getLiveGameweek);
app.get('/api/predicted-team', apiLimiter, fplController.getPredictedTeam);
app.get('/api/entry/:entryId/event/:eventId/team', apiLimiter, fplController.getUserTeam);
app.get('/api/entry/:entryId/profile', apiLimiter, fplController.getUserProfile);
app.get('/api/entry/:entryId/event/:eventId/recommended-transfers', dbReadLimiter, fplController.getRecommendedTransfers);
app.post('/api/validate-swap', apiLimiter, fplController.validateSwap);
app.post('/api/available-transfers/:playerCode', apiLimiter, fplController.getAvailableTransfers);

// Run the server directly when not loaded as a Vercel Serverless Function (CommonJS)
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Proxy server running on port ${port}`);
  });
}

module.exports = app;
