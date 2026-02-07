const jwt = require('jsonwebtoken');

const DEFAULT_JWT_SECRET = 'changeme';
const envJwtSecret = process.env.JWT_SECRET;

if ((process.env.NODE_ENV === 'production') && (!envJwtSecret || envJwtSecret === DEFAULT_JWT_SECRET)) {
  throw new Error('JWT_SECRET environment variable must be set to a secure, non-default value in production.');
}

if ((!envJwtSecret || envJwtSecret === DEFAULT_JWT_SECRET) && process.env.NODE_ENV !== 'production') {
  // Warn during development/test when using the insecure default secret.
  // Do NOT rely on this default in any production-like environment.
   
  console.warn('Warning: Using default JWT secret. Set JWT_SECRET in the environment for better security.');
}

const JWT_SECRET = envJwtSecret || DEFAULT_JWT_SECRET;
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
