const express = require('express');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const fplController = require('./controllers/fplController');
const assistantController = require('./controllers/assistantController');
const espnController = require('./controllers/espnController');
const authRoutes = require('./routes/auth');
const { apiLimiter } = require('./middleware/rateLimiter');
const app = express();
const port = process.env.PORT || 5000;

const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
};
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json());

// ── ETag + Cache-Control middleware for JSON API responses ────────────────────
// Applied selectively to GET routes that return stable-ish JSON blobs.
// Clients that send If-None-Match get 304 Not Modified when content hasn't changed.
//
// RFC 7232 §3.2: If-None-Match may contain a comma-separated list of ETags or
// a wildcard "*".  We check each token after stripping optional W/ prefix so
// both strong and weak ETags are matched correctly.
const matchesEtag = (ifNoneMatch, etag) => {
  if (!ifNoneMatch) return false;
  if (ifNoneMatch.trim() === '*') return true;
  // Strip W/ prefix from the request tag(s), then compare to our strong tag.
  return ifNoneMatch.split(',').some((t) => t.trim().replace(/^W\//, '') === etag);
};

const withCacheHeaders = (maxAgeSec, swr = 0) => (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    // Serialize once — reuse the string both for the ETag hash and the response body.
    const raw  = JSON.stringify(body);
    const etag = '"' + crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16) + '"';
    res.setHeader('ETag', etag);
    const directive = swr > 0
      ? `public, max-age=${maxAgeSec}, stale-while-revalidate=${swr}`
      : `public, max-age=${maxAgeSec}`;
    res.setHeader('Cache-Control', directive);
    if (matchesEtag(req.headers['if-none-match'], etag)) {
      return res.status(304).end();
    }
    // Send the already-serialised string to avoid a second JSON.stringify call.
    res.setHeader('Content-Type', 'application/json');
    return res.end(raw);
  };
  next();
};

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
app.get('/api/leagues-classic/:leagueId/standings', apiLimiter, fplController.getLeagueStandings);
app.get('/api/entry/:entryId/event/:eventId/recommended-transfers', apiLimiter, fplController.getRecommendedTransfers);
app.get('/api/entry/:entryId/transfers', apiLimiter, fplController.getEntryTransfers);
app.post('/api/validate-swap', apiLimiter, fplController.validateSwap);
app.post('/api/available-transfers/:playerCode', apiLimiter, fplController.getAvailableTransfers);

// Assistant Manager hints
// NOTE: /general must be registered before /:entryId to avoid route shadowing
app.get('/api/assistant/general', apiLimiter, assistantController.getAssistantHints);
app.get('/api/assistant/:entryId', apiLimiter, assistantController.getAssistantHints);

// ESPN API proxy routes — browser never calls ESPN directly
app.get('/api/espn/scoreboard', apiLimiter, espnController.getScoreboard);
app.get('/api/espn/summary/:eventId', apiLimiter, espnController.getSummary);

// Auth routes (user registration, login, profile management)
app.use('/api/auth', authRoutes);

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
