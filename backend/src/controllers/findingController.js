const Finding = require('../models/Finding');
const Audit = require('../models/Audit');
const { generateFindingId } = require('../utils/generateId');
const { logAction } = require('../utils/auditLogger');

// GET /api/v1/audits/:auditId/findings
const getFindings = async (req, res) => {
  const { auditId } = req.params;
  const { severity, category } = req.query;

  const audit = await Audit.findById(auditId);
  if (!audit) {
    return res.status(404).json({ success: false, message: 'Audit not found.' });
  }

  const filter = { audit: auditId };
  if (severity) filter.severity = severity;
  if (category) filter.category = { $regex: category, $options: 'i' };

  const findings = await Finding.find(filter)
    .populate('createdBy', 'name email')
    .sort({ severity: 1, createdAt: -1 });

  return res.status(200).json({ success: true, findings, total: findings.length });
};

// POST /api/v1/audits/:auditId/findings
const createFinding = async (req, res) => {
  const { auditId } = req.params;
  const { category, observation, severity, recommendation, remarks } = req.body;

  if (!category || !observation || !severity) {
    return res.status(400).json({ success: false, message: 'category, observation, and severity are required.' });
  }

  const audit = await Audit.findById(auditId);
  if (!audit) {
    return res.status(404).json({ success: false, message: 'Audit not found.' });
  }

  const ACTIVE_STATUSES = ['IN_PROGRESS', 'RETURNED'];
  if (!ACTIVE_STATUSES.includes(audit.status)) {
    return res.status(400).json({
      success: false,
      message: `Cannot add findings when audit is in '${audit.status}' status.`,
    });
  }

  const findingId = await generateFindingId();

  const finding = await Finding.create({
    findingId,
    audit: auditId,
    category,
    observation,
    severity,
    recommendation,
    remarks,
    createdBy: req.user._id,
  });

  await finding.populate('createdBy', 'name email');

  // Add to audit timeline
  await Audit.findByIdAndUpdate(auditId, {
    $push: {
      activityTimeline: {
        action: 'FINDING_ADDED',
        performedBy: req.user._id,
        performedByRole: req.user.role,
        timestamp: new Date(),
        details: { findingId, severity, category },
      },
    },
  });

  return res.status(201).json({ success: true, message: 'Finding created.', finding });
};

// PUT /api/v1/audits/:auditId/findings/:findingId
const updateFinding = async (req, res) => {
  const { auditId, findingId } = req.params;

  const finding = await Finding.findOne({ _id: findingId, audit: auditId });
  if (!finding) {
    return res.status(404).json({ success: false, message: 'Finding not found.' });
  }

  const audit = await Audit.findById(auditId);
  if (!audit || !['IN_PROGRESS', 'RETURNED'].includes(audit.status)) {
    return res.status(400).json({ success: false, message: 'Findings can only be updated while an audit is in progress or returned for correction.' });
  }

  // Only creator or admin can update
  if (req.user.role !== 'ADMIN' && finding.createdBy.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized to update this finding.' });
  }

  const allowedFields = ['category', 'observation', 'severity', 'recommendation', 'remarks'];
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      finding[field] = req.body[field];
    }
  });

  await finding.save();

  return res.status(200).json({ success: true, message: 'Finding updated.', finding });
};

// DELETE /api/v1/audits/:auditId/findings/:findingId
const deleteFinding = async (req, res) => {
  const { auditId, findingId } = req.params;

  const finding = await Finding.findOne({ _id: findingId, audit: auditId });
  if (!finding) {
    return res.status(404).json({ success: false, message: 'Finding not found.' });
  }

  if (req.user.role !== 'ADMIN' && finding.createdBy.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized to delete this finding.' });
  }

  const audit = await Audit.findById(auditId);
  if (!audit || !['IN_PROGRESS', 'RETURNED'].includes(audit.status)) {
    return res.status(400).json({ success: false, message: 'Findings can only be deleted while an audit is in progress or returned for correction.' });
  }

  await finding.deleteOne();

  await logAction({
    userId: req.user._id,
    userRole: req.user.role,
    action: 'FINDING_DELETED',
    entity: 'Finding',
    entityId: finding._id,
    oldValue: { findingId: finding.findingId, severity: finding.severity },
    req,
  });

  return res.status(200).json({ success: true, message: 'Finding deleted.' });
};

module.exports = { getFindings, createFinding, updateFinding, deleteFinding };
