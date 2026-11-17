const jwt = require('jsonwebtoken');
const User = require('../models/User');

const createError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

// Protect routes - require valid access token
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return next(createError('Access denied. No token provided.', 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-passwordHash -refreshTokens');

    if (!user) {
      return next(createError('User not found. Token invalid.', 401));
    }

    if (!user.isActive) {
      return next(createError('Your account has been deactivated. Please contact admin.', 403));
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return next(
        createError(
          `Account is locked until ${user.lockedUntil.toISOString()}. Please try again later.`,
          403
        )
      );
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(createError('Access token expired. Please refresh your session.', 401));
    }
    return next(createError('Invalid token.', 401));
  }
};

// Role-based access control
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(createError('Authentication required.', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        createError(
          `Access denied. Role '${req.user.role}' is not authorized to access this resource.`,
          403
        )
      );
    }

    next();
  };
};

// Optional auth - attach user if token exists, don't fail if not
const optionalAuth = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-passwordHash -refreshTokens');

    if (user && user.isActive) {
      req.user = user;
    }
  } catch {
    // Silently ignore token errors in optional auth
  }

  next();
};

module.exports = { protect, authorize, optionalAuth };
