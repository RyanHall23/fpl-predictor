const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transferController');
const authMiddleware = require('../middleware/authMiddleware');

// Make a transfer
router.post('/', authMiddleware, transferController.makeTransfer);

// Get transfer history
router.get('/history/:userId', authMiddleware, transferController.getTransferHistory);

// Get transfer summary for a gameweek
router.get('/summary/:userId/:gameweek', authMiddleware, transferController.getTransferSummary);

module.exports = router;
