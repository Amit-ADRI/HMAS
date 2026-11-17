const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Evidence = require('../models/Evidence');
const Audit = require('../models/Audit');
const Finding = require('../models/Finding');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const auditDir = path.join(uploadsDir, req.params.auditId || 'misc');
    if (!fs.existsSync(auditDir)) {
      fs.mkdirSync(auditDir, { recursive: true });
    }
    cb(null, auditDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `evidence-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'video/mp4',
    'video/quicktime',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type '${file.mimetype}' is not allowed.`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

// Middleware to handle single file upload
const uploadMiddleware = upload.single('file');

// POST /api/v1/audits/:auditId/evidence
const uploadEvidence = async (req, res) => {
  const { auditId } = req.params;

  const audit = await Audit.findById(auditId);
  if (!audit) {
    return res.status(404).json({ success: false, message: 'Audit not found.' });
  }
  if (!['IN_PROGRESS', 'RETURNED'].includes(audit.status)) {
    return res.status(400).json({ success: false, message: 'Evidence can only be uploaded while an audit is in progress or returned for correction.' });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded.' });
  }

  const { findingId, description } = req.body;

  // Validate finding if provided
  if (findingId) {
    const finding = await Finding.findOne({ _id: findingId, audit: auditId });
    if (!finding) {
      return res.status(404).json({ success: false, message: 'Finding not found for this audit.' });
    }
  }

  const storageKey = path.relative(
    path.join(__dirname, '../../..'),
    req.file.path
  ).replace(/\\/g, '/');

  const evidence = await Evidence.create({
    audit: auditId,
    finding: findingId || undefined,
    filename: req.file.filename,
    originalName: req.file.originalname,
    fileType: req.file.mimetype,
    fileSize: req.file.size,
    storageKey,
    uploadedBy: req.user._id,
    uploadedAt: new Date(),
    description,
  });

  // If linked to finding, push evidenceId to finding
  if (findingId) {
    await Finding.findByIdAndUpdate(findingId, { $addToSet: { evidenceIds: evidence._id } });
  }

  return res.status(201).json({ success: true, message: 'Evidence uploaded.', evidence });
};

// GET /api/v1/audits/:auditId/evidence
const getEvidence = async (req, res) => {
  const { auditId } = req.params;
  const { findingId } = req.query;

  const filter = { audit: auditId };
  if (findingId) filter.finding = findingId;

  const evidence = await Evidence.find(filter)
    .populate('uploadedBy', 'name email')
    .sort({ uploadedAt: -1 });

  // Build download URLs
  const evidenceWithUrls = evidence.map((e) => ({
    ...e.toObject(),
    downloadUrl: `/api/v1/audits/${auditId}/evidence/${e._id}/download`,
  }));

  return res.status(200).json({ success: true, evidence: evidenceWithUrls, total: evidence.length });
};

// GET /api/v1/audits/:auditId/evidence/:evidenceId/download
const downloadEvidence = async (req, res) => {
  const { auditId, evidenceId } = req.params;

  const evidence = await Evidence.findOne({ _id: evidenceId, audit: auditId });
  if (!evidence) {
    return res.status(404).json({ success: false, message: 'Evidence not found.' });
  }

  const filePath = path.join(__dirname, '../../..', evidence.storageKey);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'File not found on disk.' });
  }

  res.setHeader('Content-Disposition', `attachment; filename="${evidence.originalName}"`);
  res.setHeader('Content-Type', evidence.fileType);
  return res.sendFile(filePath);
};

// DELETE /api/v1/audits/:auditId/evidence/:evidenceId
const deleteEvidence = async (req, res) => {
  const { auditId, evidenceId } = req.params;

  const evidence = await Evidence.findOne({ _id: evidenceId, audit: auditId });
  if (!evidence) {
    return res.status(404).json({ success: false, message: 'Evidence not found.' });
  }

  const audit = await Audit.findById(auditId);
  if (!audit || !['IN_PROGRESS', 'RETURNED'].includes(audit.status)) {
    return res.status(400).json({ success: false, message: 'Evidence can only be deleted while an audit is in progress or returned for correction.' });
  }

  // Only uploader or admin can delete
  if (req.user.role !== 'ADMIN' && evidence.uploadedBy.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized.' });
  }

  // Remove file from disk
  const filePath = path.join(__dirname, '../../..', evidence.storageKey);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  // Remove from finding evidenceIds
  if (evidence.finding) {
    await Finding.findByIdAndUpdate(evidence.finding, { $pull: { evidenceIds: evidence._id } });
  }

  await evidence.deleteOne();

  return res.status(200).json({ success: true, message: 'Evidence deleted.' });
};

module.exports = { upload, uploadMiddleware, uploadEvidence, getEvidence, downloadEvidence, deleteEvidence };
