const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for authentication routes
 * Stricter limits to prevent brute force attacks
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for general API routes
 * Moderate limits for normal operations
 */
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for database write operations
 * Stricter limits to prevent abuse
 */
const dbWriteLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per window
  message: 'Too many write operations, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for database read operations
 * More relaxed limits for read operations
 */
const dbReadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per window
  message: 'Too many read operations, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Strict rate limiter for the calibration endpoint.
 * Calibration fans out many upstream FPL API requests and mutates
 * server-side state, so it must be called sparingly.
 */
const calibrateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3, // 3 calibration runs per 10-minute window
  message: 'Too many calibration requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  authLimiter,
  apiLimiter,
  dbWriteLimiter,
  dbReadLimiter,
  calibrateLimiter,
};
