const express = require('express');
const router = express.Router();
const squadController = require('../controllers/squadController');
const authMiddleware = require('../middleware/authMiddleware');

// Initialize squad from FPL API
router.post('/initialize', authMiddleware, squadController.initializeSquad);

// Get current squad
router.get('/:userId', authMiddleware, squadController.getSquad);

// Get squad history for specific gameweek
router.get('/history/:userId/:gameweek', authMiddleware, squadController.getSquadHistory);

// Get all squad history
router.get('/history/:userId', authMiddleware, squadController.getAllSquadHistory);

// Update squad for new gameweek
router.post('/update-gameweek', authMiddleware, squadController.updateForNewGameweek);

module.exports = router;
