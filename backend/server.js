const express = require('express');
const cors = require('cors');
const fplController = require('./controllers/fplController');
const app = express();
const port = 5000;

app.use(cors());

app.get('/api/bootstrap-static', fplController.getBootstrapStatic);
app.get('/api/entry/:entryId/event/:eventId/picks', fplController.getPlayerPicks);
app.get('/api/element-summary/:playerId', fplController.getElementSummary);
app.get('/api/predicted-team', fplController.getPredictedTeam); // <-- Add this line
app.get('/api/entry/:entryId/event/:eventId/team', fplController.getUserTeam); // <-- add this line

app.listen(port, () => {
  console.log(`Proxy server running on http://localhost:${port}`);
});