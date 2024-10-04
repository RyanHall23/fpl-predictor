const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const port = 5000;

app.use(cors());

app.get('/api/bootstrap-static', async (req, res) => {
  try {
    const response = await axios.get(
      'https://fantasy.premierleague.com/api/bootstrap-static/'
    );
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching data from FPL API:', error);
    res.status(500).json({ error: 'Error fetching data from FPL API' });
  }
});

app.get('/api/entry/:entryId/event/:eventId/picks', async (req, res) => {
  const { entryId, eventId } = req.params;
  try {
    const response = await axios.get(
      `https://fantasy.premierleague.com/api/entry/${entryId}/event/${eventId}/picks/`
    );
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching data from FPL API:', error);
    res.status(500).json({ error: 'Error fetching data from FPL API' });
  }
});

app.listen(port, () => {
  console.log(`Proxy server running on http://localhost:${port}`);
});
