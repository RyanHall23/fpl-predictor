const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// Rate limiting for registration endpoint
const rateLimit = require('express-rate-limit');

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many accounts created from this IP, please try again after an hour'
});

router.post('/register', registerLimiter, authController.register);

// Rate limiting for login endpoint
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minute window
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many login attempts from this IP, please try again after 15 minutes'
});

router.post('/login', loginLimiter, authController.login);

// Rate limiting for authenticated routes
const authRoutesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minute window
  max: 100, // limit each IP to 100 requests per windowMs for authenticated routes
  message: 'Too many requests from this IP, please try again after 15 minutes'
});

// Protected routes - require authentication
router.get('/profile', authRoutesLimiter, authMiddleware, authController.getProfile);
router.put('/username', authMiddleware, authController.updateUsername);
router.put('/email', authRoutesLimiter, authMiddleware, authController.updateEmail);
router.put('/password', authRoutesLimiter, authMiddleware, authController.updatePassword);
router.put('/teamid', authMiddleware, authController.updateTeamId);
router.delete('/account', authMiddleware, authController.deleteAccount);

module.exports = router;
