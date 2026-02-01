const express = require('express');
const router = express.Router();
const chipController = require('../controllers/chipController');
const authMiddleware = require('../middleware/authMiddleware');

// Get available chips
router.get('/:userId', authMiddleware, chipController.getAvailableChips);

// Activate a chip
router.post('/activate', authMiddleware, chipController.activateChip);

// Cancel a chip (before deadline)
router.post('/cancel', authMiddleware, chipController.cancelChip);

module.exports = router;
