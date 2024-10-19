const express = require('express');
const axios = require('axios');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');

const app = express();
const port = 5000;

app.use(cors());
app.use(bodyParser.json());

const users = [{ username: 'user', password: 'password', team: { mainTeam: [], benchTeam: [] }, teamId: '123' }];
const secret = 'your_jwt_secret';

// User authentication routes
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find((u) => u.username === username && u.password === password);
  if (user) {
    const token = jwt.sign({ username }, secret, { expiresIn: '1h' });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/api/signup', (req, res) => {
  const { username, password, teamId } = req.body;

  // Check if the username already exists
  const existingUser = users.find((u) => u.username === username);
  if (existingUser) {
    return res.status(400).json({ error: 'Username already taken' });
  }

  // Create a new user
  const newUser = { username, password, team: { mainTeam: [], benchTeam: [] }, teamId };
  users.push(newUser);

  // Generate a token
  const token = jwt.sign({ username }, secret, { expiresIn: '1h' });

  res.json({ token });
});

app.get('/api/team', (req, res) => {
  const token = req.headers.authorization.split(' ')[1];
  const decoded = jwt.verify(token, secret);
  const user = users.find((u) => u.username === decoded.username);
  res.json(user.team);
});

app.post('/api/team', (req, res) => {
  const token = req.headers.authorization.split(' ')[1];
  const decoded = jwt.verify(token, secret);
  const user = users.find((u) => u.username === decoded.username);
  user.team = req.body;
  res.json({ success: true });
});

// Proxy routes to Fantasy Premier League API
app.get('/api/bootstrap-static', async (req, res) => {
  try {
    const response = await axios.get(
      'https://fantasy.premierleague.com/api/bootstrap-static/',
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
      `https://fantasy.premierleague.com/api/entry/${entryId}/event/${eventId}/picks/`,
    );
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching data from FPL API:', error);
    res.status(500).json({ error: 'Error fetching data from FPL API' });
  }
});

app.get('/api/element-summary/:playerId', async (req, res) => {
  const { playerId } = req.params;
  try {
    const response = await axios.get(
      `https://fantasy.premierleague.com/api/element-summary/${playerId}/`,
    );
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching data from FPL API:', error);
    res.status(500).json({ error: 'Error fetching data from FPL API' });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
