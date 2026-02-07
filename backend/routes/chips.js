const express = require('express');
const router = express.Router();
const chipController = require('../controllers/chipController');
const authMiddleware = require('../middleware/authMiddleware');
const { dbWriteLimiter, dbReadLimiter } = require('../middleware/rateLimiter');

// Get available chips
router.get('/:userId', dbReadLimiter, authMiddleware, chipController.getAvailableChips);

// Activate a chip
router.post('/activate', dbWriteLimiter, authMiddleware, chipController.activateChip);

// Cancel a chip (before deadline)
router.post('/cancel', dbWriteLimiter, authMiddleware, chipController.cancelChip);

module.exports = router;
