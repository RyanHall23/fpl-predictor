const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

exports.register = async (req, res) => {
  const { username, password, teamid } = req.body;
  if (!username || !password || !teamid) return res.status(400).json({ error: 'All fields required' });
  try {
    const existing = await User.findOne({ username: { $eq: username } });
    if (existing) return res.status(409).json({ error: 'Username taken' });
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hash, teamid });
    res.json({ message: 'Registered', user: { username: user.username, teamid: user.teamid } });
  } catch (e) {
    res.status(500).json({ error: 'Registration failed' });
  }
};

exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'All fields required' });
  try {
    const user = await User.findOne({ username: { $eq: username } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id, username: user.username, teamid: user.teamid }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, username: user.username, teamid: user.teamid });
  } catch (e) {
    res.status(500).json({ error: 'Login failed' });
  }
};