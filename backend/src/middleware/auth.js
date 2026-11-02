const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

exports.protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'Not authenticated');

  let payload;
  try {
    payload = jwt.verify(token, jwtSecret);
  } catch {
    throw new ApiError(401, 'Session expired, please login again');
  }
  const user = await User.findById(payload.id);
  if (!user || !user.isActive) throw new ApiError(401, 'Account not found or deactivated');
  req.user = user;
  next();
});

// Role-based access control. Super admin always passes.
exports.authorize = (...roles) => (req, res, next) => {
  if (req.user.role === 'super_admin' || roles.includes(req.user.role)) return next();
  next(new ApiError(403, 'You do not have permission to perform this action'));
};
