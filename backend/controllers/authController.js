const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

exports.register = async (req, res) => {
  const { username, password, teamid, email } = req.body;
  if (!username || !password || !teamid) return res.status(400).json({ error: 'All fields required' });
  
  // Validate username length and format
  const trimmedUsername = username.trim();
  if (trimmedUsername.length < 3 || trimmedUsername.length > 30) {
    return res.status(400).json({ error: 'Username must be between 3 and 30 characters' });
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
    return res.status(400).json({ error: 'Username can only contain letters, numbers, underscores, and hyphens' });
  }
  
  // Validate teamid format
  if (typeof teamid !== 'string' && typeof teamid !== 'number') {
    return res.status(400).json({ error: 'Invalid team ID format' });
  }
  const teamidStr = String(teamid).trim();
  if (!/^\d+$/.test(teamidStr)) {
    return res.status(400).json({ error: 'Team ID must be a valid number' });
  }
  
  // Validate password strength
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }
  
  try {
    const existing = await User.findOne({ username: { $eq: trimmedUsername } });
    if (existing) return res.status(409).json({ error: 'Username taken' });
    
    if (email) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      
      const existingEmail = await User.findOne({ email: { $eq: email } });
      if (existingEmail) return res.status(409).json({ error: 'Email already in use' });
    }
    
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ username: trimmedUsername, password: hash, teamid: teamidStr, email: email || undefined });
    res.json({ message: 'Registered', user: { username: user.username, teamid: user.teamid, email: user.email } });
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
    res.json({ token, username: user.username, teamid: user.teamid, email: user.email });
  } catch (e) {
    res.status(500).json({ error: 'Login failed' });
  }
};

// Get user profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ username: user.username, email: user.email, teamid: user.teamid });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

// Update username
exports.updateUsername = async (req, res) => {
  const { username } = req.body;
  if (typeof username !== 'string' || username.trim() === '') {
    return res.status(400).json({ error: 'Username required' });
  }
  const safeUsername = username.trim();
  
  // Validate username length and format
  if (safeUsername.length < 3 || safeUsername.length > 30) {
    return res.status(400).json({ error: 'Username must be between 3 and 30 characters' });
  }
  
  // Allow alphanumeric, underscores, and hyphens
  if (!/^[a-zA-Z0-9_-]+$/.test(safeUsername)) {
    return res.status(400).json({ error: 'Username can only contain letters, numbers, underscores, and hyphens' });
  }
  
  try {
    const existing = await User.findOne({ username: { $eq: safeUsername }, _id: { $ne: req.user.id } });
    if (existing) return res.status(409).json({ error: 'Username already taken' });
    
    const user = await User.findByIdAndUpdate(req.user.id, { username: safeUsername }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Generate new token with updated username
    const token = jwt.sign({ id: user._id, username: user.username, teamid: user.teamid }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ message: 'Username updated', token, username: user.username });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update username' });
  }
};

// Update email
exports.updateEmail = async (req, res) => {
  const { email } = req.body;

  try {
    let trimmedEmail = undefined;

    if (email !== undefined) {
      // Ensure email is a non-empty string to avoid injecting objects or other unexpected types
      if (typeof email !== 'string') {
        return res.status(400).json({ error: 'Invalid email' });
      }
      trimmedEmail = email.trim();
      if (!trimmedEmail) {
        return res.status(400).json({ error: 'Invalid email' });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      const existing = await User.findOne({ email: { $eq: trimmedEmail }, _id: { $ne: req.user.id } });
      if (existing) return res.status(409).json({ error: 'Email already in use' });
    }

    const update = {};
    if (trimmedEmail !== undefined) {
      update.email = trimmedEmail;
    }

    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ message: 'Email updated', email: user.email });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update email' });
  }
};

// Update password
exports.updatePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password required' });
  
  // Validate new password strength
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }
  
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });
    
    const hash = await bcrypt.hash(newPassword, 10);
    user.password = hash;
    await user.save();
    
    res.json({ message: 'Password updated successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update password' });
  }
};

// Update team ID
exports.updateTeamId = async (req, res) => {
  const { teamid } = req.body;
  if (!teamid) return res.status(400).json({ error: 'Team ID required' });
  
  // Validate teamid format (must be numeric string)
  if (typeof teamid !== 'string' && typeof teamid !== 'number') {
    return res.status(400).json({ error: 'Invalid team ID format' });
  }
  
  const teamidStr = String(teamid).trim();
  if (!/^\d+$/.test(teamidStr)) {
    return res.status(400).json({ error: 'Team ID must be a valid number' });
  }
  
  try {
    const user = await User.findByIdAndUpdate(req.user.id, { teamid: teamidStr }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Generate new token with updated teamid
    const token = jwt.sign({ id: user._id, username: user.username, teamid: user.teamid }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ message: 'Team ID updated', token, teamid: user.teamid });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update team ID' });
  }
};

// Delete account - requires password verification
exports.deleteAccount = async (req, res) => {
  const { password, confirmDelete } = req.body;
  
  if (!password) return res.status(400).json({ error: 'Password required' });
  if (!confirmDelete) return res.status(400).json({ error: 'Delete confirmation required' });
  
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Verify password
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Incorrect password' });
    
    // Delete the user
    await User.findByIdAndDelete(req.user.id);
    
    res.json({ message: 'Account deleted successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete account' });
  }
};