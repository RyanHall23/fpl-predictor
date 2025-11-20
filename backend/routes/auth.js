const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Rate limiting for registration endpoint
const rateLimit = require('express-rate-limit');

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many accounts created from this IP, please try again after an hour'
});

router.post('/register', registerLimiter, authController.register);
router.post('/login', authController.login);

module.exports = router;
