const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const fplController = require('./controllers/fplController');
const authRoutes = require('./routes/auth');
const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://localhost:27017/fplpredictor', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB error:', err));

app.use('/api/auth', authRoutes);

app.get('/api/bootstrap-static', fplController.getBootstrapStatic);
app.get('/api/entry/:entryId/event/:eventId/picks', fplController.getPlayerPicks);
app.get('/api/element-summary/:playerId', fplController.getElementSummary);
app.get('/api/predicted-team', fplController.getPredictedTeam);
app.get('/api/entry/:entryId/event/:eventId/team', fplController.getUserTeam);

app.listen(port, () => {
  console.log(`Proxy server running on http://localhost:${port}`);
});
