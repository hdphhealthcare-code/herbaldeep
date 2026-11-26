const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { jwtSecret, jwtExpiresIn } = require('../config/env');

const sign = (user) => jwt.sign({ id: user._id, role: user.role }, jwtSecret, { expiresIn: jwtExpiresIn });

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, 'Email and password are required');
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.matchPassword(password))) throw new ApiError(401, 'Invalid email or password');
  if (!user.isActive) throw new ApiError(403, 'Your account is deactivated');
  const safe = user.toObject();
  delete safe.password;
  res.json({ token: sign(user), user: safe });
});

exports.me = asyncHandler(async (req, res) => res.json(req.user));

exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.matchPassword(currentPassword))) throw new ApiError(400, 'Current password is incorrect');
  if (!newPassword || newPassword.length < 6) throw new ApiError(400, 'New password must be at least 6 characters');
  user.password = newPassword;
  await user.save();
  res.json({ message: 'Password updated' });
});
