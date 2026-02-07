const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transferController');
const authMiddleware = require('../middleware/authMiddleware');
const { dbWriteLimiter, dbReadLimiter } = require('../middleware/rateLimiter');

// Make a transfer
router.post('/', dbWriteLimiter, authMiddleware, transferController.makeTransfer);

// Get transfer history
router.get('/history/:userId', dbReadLimiter, authMiddleware, transferController.getTransferHistory);

// Get transfer summary for a gameweek
router.get('/summary/:userId/:gameweek', dbReadLimiter, authMiddleware, transferController.getTransferSummary);

module.exports = router;
