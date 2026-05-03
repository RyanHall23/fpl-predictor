const jwt = require('jsonwebtoken');

const DEFAULT_JWT_SECRET = 'changeme';

/** Cached JWT secret — evaluated once at startup, shared with authController. */
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;

// Warn once at startup when using the insecure default (development only).
if (process.env.NODE_ENV !== 'production' && JWT_SECRET === DEFAULT_JWT_SECRET) {
  console.warn('Warning: Using default JWT secret. Set JWT_SECRET in the environment for better security.');
}

/**
 * Router-level guard: apply as `router.use(requireJwtConfigured)` at the top
 * of the auth router so that every endpoint — including login and register —
 * returns 503 in production rather than operating with the insecure default
 * secret, which would enable trivial token forgery.
 */
const requireJwtConfigured = (req, res, next) => {
  if (process.env.NODE_ENV === 'production' && JWT_SECRET === DEFAULT_JWT_SECRET) {
    return res.status(503).json({ error: 'Authentication is not configured on this server.' });
  }
  next();
};

/** Route middleware: verifies the Bearer token and sets req.user. */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = authMiddleware;
module.exports.requireJwtConfigured = requireJwtConfigured;
module.exports.JWT_SECRET = JWT_SECRET;
