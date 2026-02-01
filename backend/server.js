const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const fplController = require('./controllers/fplController');
const authRoutes = require('./routes/auth');
const squadRoutes = require('./routes/squad');
const transferRoutes = require('./routes/transfers');
const chipRoutes = require('./routes/chips');
const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://localhost:27017/fplpredictor')
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB error:', err));

// Authentication routes
app.use('/api/auth', authRoutes);

// Squad management routes
app.use('/api/squad', squadRoutes);

// Transfer routes
app.use('/api/transfers', transferRoutes);

// Chip routes
app.use('/api/chips', chipRoutes);

// Chip routes
app.use('/api/chips', chipRoutes);

// FPL API proxy routes
app.get('/api/bootstrap-static', fplController.getBootstrapStatic);
app.get('/api/bootstrap-static/enriched', fplController.getAllPlayersEnriched);
app.get('/api/entry/:entryId/event/:eventId/picks', fplController.getPlayerPicks);
app.get('/api/element-summary/:playerId', fplController.getElementSummary);
app.get('/api/event/:eventId/live', fplController.getLiveGameweek);
app.get('/api/predicted-team', fplController.getPredictedTeam);
app.get('/api/entry/:entryId/event/:eventId/team', fplController.getUserTeam);
app.get('/api/entry/:entryId/profile', fplController.getUserProfile);
app.get('/api/entry/:entryId/event/:eventId/recommended-transfers', fplController.getRecommendedTransfers);
app.post('/api/validate-swap', fplController.validateSwap);
app.post('/api/available-transfers/:playerCode', fplController.getAvailableTransfers);

app.listen(port, () => {
  console.log(`Proxy server running on http://localhost:${port}`);
});
