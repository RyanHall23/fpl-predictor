const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const fplController = require('./controllers/fplController');
const authRoutes = require('./routes/auth');
const squadRoutes = require('./routes/squad');
const transferRoutes = require('./routes/transfers');
const chipRoutes = require('./routes/chips');
const { apiLimiter, dbReadLimiter } = require('./middleware/rateLimiter');
const app = express();
const port = process.env.PORT || 5000;

const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
};
app.use(cors(corsOptions));
app.use(express.json());

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fplpredictor';
mongoose.connect(mongoUri)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Authentication routes
app.use('/api/auth', authRoutes);

// Squad management routes
app.use('/api/squad', squadRoutes);

// Transfer routes
app.use('/api/transfers', transferRoutes);

// Chip routes
app.use('/api/chips', chipRoutes);

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

// Serve built Vite frontend from the same process
const distPath = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('/*splat', apiLimiter, (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`Proxy server running on port ${port}`);
});
