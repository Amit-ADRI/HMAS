const Setting = require('../models/Setting');
const { logAction } = require('../utils/auditLogger');

// GET /api/v1/settings  — get all settings
const getAllSettings = async (req, res) => {
  const settings = await Setting.find({}).populate('updatedBy', 'name email').sort({ key: 1 });

  // Return as a key-value map for convenience
  const settingsMap = {};
  settings.forEach((s) => {
    settingsMap[s.key] = s.value;
  });

  return res.status(200).json({ success: true, settings, settingsMap });
};

// GET /api/v1/settings/:key
const getSetting = async (req, res) => {
  const setting = await Setting.findOne({ key: req.params.key }).populate('updatedBy', 'name email');

  if (!setting) {
    return res.status(404).json({ success: false, message: `Setting '${req.params.key}' not found.` });
  }

  return res.status(200).json({ success: true, setting });
};

// PUT /api/v1/settings/:key  (admin only)
const updateSetting = async (req, res) => {
  const { value, description } = req.body;

  if (value === undefined) {
    return res.status(400).json({ success: false, message: 'Value is required.' });
  }

  const setting = await Setting.findOneAndUpdate(
    { key: req.params.key },
    {
      value,
      description,
      updatedBy: req.user._id,
      updatedAt: new Date(),
    },
    { new: true, upsert: true, runValidators: true }
  );

  await logAction({
    userId: req.user._id,
    userRole: req.user.role,
    action: 'SETTING_UPDATED',
    entity: 'Setting',
    entityId: setting._id,
    newValue: { key: req.params.key, value },
    req,
  });

  return res.status(200).json({ success: true, message: 'Setting updated.', setting });
};

// POST /api/v1/settings  (admin only) — create a new setting
const createSetting = async (req, res) => {
  const { key, value, description } = req.body;

  if (!key || value === undefined) {
    return res.status(400).json({ success: false, message: 'Key and value are required.' });
  }

  const existing = await Setting.findOne({ key });
  if (existing) {
    return res.status(409).json({ success: false, message: `Setting '${key}' already exists. Use PUT to update.` });
  }

  const setting = await Setting.create({
    key,
    value,
    description,
    updatedBy: req.user._id,
    updatedAt: new Date(),
  });

  return res.status(201).json({ success: true, message: 'Setting created.', setting });
};

// DELETE /api/v1/settings/:key  (admin only)
const deleteSetting = async (req, res) => {
  const PROTECTED_KEYS = [
    'districts', 'hospitalTypes', 'facilityTypes', 'specialities',
    'schemes', 'auditTypes', 'priorities',
  ];

  if (PROTECTED_KEYS.includes(req.params.key)) {
    return res.status(400).json({ success: false, message: `Cannot delete protected setting '${req.params.key}'.` });
  }

  const setting = await Setting.findOneAndDelete({ key: req.params.key });
  if (!setting) {
    return res.status(404).json({ success: false, message: `Setting '${req.params.key}' not found.` });
  }

  return res.status(200).json({ success: true, message: 'Setting deleted.' });
};

module.exports = { getAllSettings, getSetting, updateSetting, createSetting, deleteSetting };
