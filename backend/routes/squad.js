const express = require('express');
const router = express.Router();
const squadController = require('../controllers/squadController');
const authMiddleware = require('../middleware/authMiddleware');
const { dbWriteLimiter, dbReadLimiter } = require('../middleware/rateLimiter');

// Initialize squad from FPL API
router.post('/initialize', dbWriteLimiter, authMiddleware, squadController.initializeSquad);

// Get current squad
router.get('/:userId', dbReadLimiter, authMiddleware, squadController.getSquad);

// Get squad history for specific gameweek
router.get('/history/:userId/:gameweek', dbReadLimiter, authMiddleware, squadController.getSquadHistory);

// Get all squad history
router.get('/history/:userId', dbReadLimiter, authMiddleware, squadController.getAllSquadHistory);

// Update squad for new gameweek
router.post('/update-gameweek', dbWriteLimiter, authMiddleware, squadController.updateForNewGameweek);

module.exports = router;
