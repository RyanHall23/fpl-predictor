const jwt = require('jsonwebtoken');

const DEFAULT_JWT_SECRET = 'changeme';
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;

// Warn once at startup when using the insecure default (development only).
if (process.env.NODE_ENV !== 'production' && JWT_SECRET === DEFAULT_JWT_SECRET) {
  console.warn('Warning: Using default JWT secret. Set JWT_SECRET in the environment for better security.');
}

const authMiddleware = (req, res, next) => {
  // In production, refuse to process auth requests when JWT_SECRET is absent
  // or still set to the insecure default — return 503 instead of crashing the
  // process with a module-level throw.
  if (process.env.NODE_ENV === 'production' && JWT_SECRET === DEFAULT_JWT_SECRET) {
    return res.status(503).json({ error: 'Authentication is not configured on this server.' });
  }

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
