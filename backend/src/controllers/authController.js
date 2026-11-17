const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const { generateUserId } = require('../utils/generateId');
const { logAction } = require('../utils/auditLogger');

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// POST /api/v1/auth/login
const login = async (req, res) => {
  const { email, password } = req.body;
  const identifier = email?.trim();

  if (!identifier || !password) {
    return res.status(400).json({ success: false, message: 'Email or User ID and password are required.' });
  }

  const user = await User.findOne({ $or: [{ email: identifier.toLowerCase() }, { userId: identifier.toUpperCase() }] }).select(
    '+passwordHash +refreshTokens +failedLoginAttempts +lockedUntil'
  );

  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  if (!user.isActive) {
    return res.status(403).json({ success: false, message: 'Your account is deactivated. Contact admin.' });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);

  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  // Successful login
  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  user.lastLogin = new Date();

  // Limit login history to last 10 entries
  user.loginHistory = user.loginHistory || [];
  user.loginHistory.unshift({
    ip: req.ip,
    device: req.headers['user-agent'],
    timestamp: new Date(),
  });
  if (user.loginHistory.length > 10) {
    user.loginHistory = user.loginHistory.slice(0, 10);
  }

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  // Store refresh token
  user.refreshTokens = user.refreshTokens || [];
  user.refreshTokens.push({ token: refreshToken, createdAt: new Date() });
  // Keep max 5 refresh tokens per user
  if (user.refreshTokens.length > 5) {
    user.refreshTokens = user.refreshTokens.slice(-5);
  }

  await user.save();

  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

  await logAction({
    userId: user._id,
    userRole: user.role,
    action: 'USER_LOGIN',
    entity: 'User',
    entityId: user._id,
    req,
  });

  return res.status(200).json({
    success: true,
    message: 'Login successful.',
    accessToken,
    // Compatibility alias for existing frontend/API consumers.
    token: accessToken,
    user: {
      _id: user._id,
      userId: user.userId,
      name: user.name,
      email: user.email,
      role: user.role,
      mobile: user.mobile,
      lastLogin: user.lastLogin,
    },
  });
};

// POST /api/v1/auth/logout
const logout = async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;

  if (refreshToken) {
    const user = await User.findOne({ 'refreshTokens.token': refreshToken }).select('+refreshTokens');
    if (user) {
      user.refreshTokens = user.refreshTokens.filter((t) => t.token !== refreshToken);
      await user.save();
    }
  }

  res.clearCookie('refreshToken');

  return res.status(200).json({ success: true, message: 'Logged out successfully.' });
};

// POST /api/v1/auth/refresh-token
const refreshToken = async (req, res) => {
  const token = req.cookies?.refreshToken;

  if (!token) {
    return res.status(401).json({ success: false, message: 'No refresh token provided.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    res.clearCookie('refreshToken');
    return res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
  }

  const user = await User.findById(decoded.id).select('+refreshTokens');

  if (!user) {
    return res.status(401).json({ success: false, message: 'User not found.' });
  }

  const tokenExists = user.refreshTokens.some((t) => t.token === token);
  if (!tokenExists) {
    return res.status(401).json({ success: false, message: 'Refresh token is not valid.' });
  }

  if (!user.isActive) {
    return res.status(403).json({ success: false, message: 'Account deactivated.' });
  }

  const newAccessToken = user.generateAccessToken();

  return res.status(200).json({
    success: true,
    accessToken: newAccessToken,
  });
};

// POST /api/v1/auth/forgot-password
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required.' });
  }

  const user = await User.findOne({ email: email.toLowerCase() });

  // Always return success to avoid user enumeration
  if (!user) {
    return res.status(200).json({
      success: true,
      message: 'If an account exists with that email, a reset link has been sent.',
    });
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  user.passwordResetToken = hashedToken;
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await user.save({ validateBeforeSave: false });

  // In production, send email here. For now, log it.
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  console.log(`[PASSWORD RESET] Token for ${email}: ${resetUrl}`);

  return res.status(200).json({
    success: true,
    message: 'If an account exists with that email, a reset link has been sent.',
    ...(process.env.NODE_ENV === 'development' && { resetUrl }),
  });
};

// POST /api/v1/auth/reset-password
const resetPassword = async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ success: false, message: 'Token and new password are required.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordHash');

  if (!user) {
    return res.status(400).json({ success: false, message: 'Invalid or expired reset token.' });
  }

  const salt = await bcrypt.genSalt(12);
  user.passwordHash = await bcrypt.hash(password, salt);
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.refreshTokens = [];
  await user.save({ validateBeforeSave: false });

  res.clearCookie('refreshToken');

  await logAction({
    userId: user._id,
    userRole: user.role,
    action: 'PASSWORD_RESET',
    entity: 'User',
    entityId: user._id,
    req,
  });

  return res.status(200).json({ success: true, message: 'Password reset successful. Please log in.' });
};

// PUT /api/v1/auth/change-password (protected)
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Current and new password are required.' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'New password must be at least 8 characters.' });
  }

  const user = await User.findById(req.user._id).select('+passwordHash');

  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
  }

  const salt = await bcrypt.genSalt(12);
  user.passwordHash = await bcrypt.hash(newPassword, salt);
  user.refreshTokens = [];
  await user.save({ validateBeforeSave: false });

  res.clearCookie('refreshToken');

  await logAction({
    userId: user._id,
    userRole: user.role,
    action: 'PASSWORD_CHANGED',
    entity: 'User',
    entityId: user._id,
    req,
  });

  return res.status(200).json({ success: true, message: 'Password changed successfully. Please log in again.' });
};

// GET /api/v1/auth/me (protected)
const getMe = async (req, res) => {
  const user = await User.findById(req.user._id);
  return res.status(200).json({ success: true, user });
};

// PUT /api/v1/auth/profile (protected)
const updateProfile = async (req, res) => {
  const allowedFields = ['name', 'mobile'];
  const updates = {};

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, message: 'No valid fields to update.' });
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  });

  await logAction({
    userId: req.user._id,
    userRole: req.user.role,
    action: 'PROFILE_UPDATED',
    entity: 'User',
    entityId: req.user._id,
    newValue: updates,
    req,
  });

  return res.status(200).json({ success: true, message: 'Profile updated.', user });
};

module.exports = {
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  changePassword,
  getMe,
  updateProfile,
};
