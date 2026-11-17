const User = require('../models/User');
const Team = require('../models/Team');
const { generateUserId } = require('../utils/generateId');
const { logAction } = require('../utils/auditLogger');

// GET /api/v1/users  (admin only)
const getUsers = async (req, res) => {
  const { role, isActive, search, page = 1, limit = 20 } = req.query;

  const filter = {};
  if (role) filter.role = role;
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { userId: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
    User.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    users,
  });
};

// POST /api/v1/users  (admin only)
const createUser = async (req, res) => {
  const { name, email, mobile, role, password } = req.body;

  if (!name || !email || !role || !password) {
    return res.status(400).json({ success: false, message: 'Name, email, role, and password are required.' });
  }

  if (!['ADMIN', 'TEAM_LEAD'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Role must be ADMIN or TEAM_LEAD.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    return res.status(409).json({ success: false, message: 'A user with this email already exists.' });
  }

  const userId = await generateUserId();
  const user = await User.create({
    userId,
    name,
    email: email.toLowerCase(),
    mobile,
    role,
    // The User model hashes this plaintext exactly once in its pre-save hook.
    passwordHash: password,
    isActive: true,
  });

  await logAction({
    userId: req.user._id,
    userRole: req.user.role,
    action: 'USER_CREATED',
    entity: 'User',
    entityId: user._id,
    newValue: { name, email, role },
    req,
  });

  return res.status(201).json({ success: true, message: 'User created successfully.', user });
};

// PUT /api/v1/users/:id  (admin only)
const updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, mobile, role, password } = req.body;

  const user = await User.findById(id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  const oldValue = { name: user.name, email: user.email, mobile: user.mobile, role: user.role };

  if (name) user.name = name;
  if (email && email.toLowerCase() !== user.email) {
    const existing = await User.findOne({ email: email.toLowerCase(), _id: { $ne: user._id } });
    if (existing) return res.status(409).json({ success: false, message: 'A user with this email already exists.' });
    user.email = email.toLowerCase();
  }
  if (mobile) user.mobile = mobile;
  if (role && ['ADMIN', 'TEAM_LEAD'].includes(role)) user.role = role;
  if (password) {
    if (password.length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    user.passwordHash = password;
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    user.refreshTokens = [];
  }

  await user.save();

  await logAction({
    userId: req.user._id,
    userRole: req.user.role,
    action: 'USER_UPDATED',
    entity: 'User',
    entityId: user._id,
    oldValue,
    newValue: { name: user.name, email: user.email, mobile: user.mobile, role: user.role, passwordReset: Boolean(password) },
    req,
  });

  return res.status(200).json({ success: true, message: 'User updated.', user });
};

// PATCH /api/v1/users/:id/toggle-status  (admin only)
const toggleUserStatus = async (req, res) => {
  const { id } = req.params;

  // Prevent admin from deactivating themselves
  if (id === req.user._id.toString()) {
    return res.status(400).json({ success: false, message: 'You cannot change your own status.' });
  }

  const user = await User.findById(id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  const oldStatus = user.isActive;
  user.isActive = !user.isActive;
  await user.save();

  await logAction({
    userId: req.user._id,
    userRole: req.user.role,
    action: user.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
    entity: 'User',
    entityId: user._id,
    oldValue: { isActive: oldStatus },
    newValue: { isActive: user.isActive },
    req,
  });

  return res.status(200).json({
    success: true,
    message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully.`,
    user,
  });
};

// DELETE /api/v1/users/:id  (admin only)
const deleteUser = async (req, res) => {
  const { id } = req.params;
  if (id === req.user._id.toString()) return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  const leadingTeam = await Team.findOne({ teamLead: user._id });
  if (leadingTeam) return res.status(400).json({ success: false, message: `Reassign or delete team '${leadingTeam.teamName}' before deleting its Team Lead.` });
  await User.deleteOne({ _id: user._id });
  await logAction({ userId: req.user._id, userRole: req.user.role, action: 'USER_DELETED', entity: 'User', entityId: user._id, oldValue: { name: user.name, email: user.email, role: user.role }, req });
  return res.status(200).json({ success: true, message: 'User deleted.' });
};

module.exports = { getUsers, createUser, updateUser, toggleUserStatus, deleteUser };
