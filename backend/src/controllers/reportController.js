const AuditReport = require('../models/AuditReport');
const Audit = require('../models/Audit');
const Assignment = require('../models/Assignment');
const AuditResponse = require('../models/AuditResponse');
const Finding = require('../models/Finding');
const Evidence = require('../models/Evidence');
const AuditSchedule = require('../models/AuditSchedule');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const Team = require('../models/Team');
const User = require('../models/User');
const { notifyReportSubmitted, notifyReportReturned, notifyReportApproved } = require('../utils/notificationService');
const { logAction } = require('../utils/auditLogger');

const teamLeadOwnsAudit = async (userId, auditId) => {
  const team = await Team.findOne({ teamLead: userId, isActive: true });
  return Boolean(team && await Assignment.exists({ audit: auditId, team: team._id, status: { $nin: ['REASSIGNED', 'CANCELLED'] } }));
};

const downloadReportPdf = async (req, res) => {
  const audit = await Audit.findById(req.params.auditId).populate('hospital', 'facilityName facilityId district state');
  if (!audit) return res.status(404).json({ success: false, message: 'Audit not found.' });
  const [report, assignment] = await Promise.all([
    AuditReport.findOne({ audit: audit._id }),
    Assignment.findOne({ audit: audit._id, status: { $nin: ['REASSIGNED', 'CANCELLED'] } })
      .populate({ path: 'team', select: 'teamId teamName teamLeadEmail teamLead', populate: { path: 'teamLead', select: 'name email' } })
      .populate('acknowledgedBy', 'name email'),
  ]);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${audit.auditNumber.replace(/[^a-z0-9-_]/gi, '_')}.pdf"`);
  const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true, info: { Title: `Audit Report ${audit.auditNumber}`, Author: 'HMAS' } });
  doc.pipe(res);
  const pageWidth = doc.page.width - 96;
  const addHeader = () => {
    doc.rect(48, 42, pageWidth, 54).fill('#1e3a8a');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18).text('HOSPITAL AUDIT REPORT', 64, 57);
    doc.font('Helvetica').fontSize(9).text('Hospital Audit Management System (HMAS)', 64, 79);
    doc.fillColor('#334155').font('Helvetica-Bold').fontSize(10).text(audit.auditNumber, 400, 62, { width: 130, align: 'right' });
    doc.y = 116;
  };
  const needSpace = (height) => { if (doc.y + height > 760) { doc.addPage(); addHeader(); } };
  const section = (title) => { needSpace(40); doc.moveDown(0.7).fillColor('#1e3a8a').font('Helvetica-Bold').fontSize(12).text(title.toUpperCase()); doc.moveTo(48, doc.y + 4).lineTo(547, doc.y + 4).strokeColor('#bfdbfe').stroke(); doc.moveDown(0.7); };
  const field = (label, value, x, y, width) => { doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(8).text(label.toUpperCase(), x, y, { width }); doc.fillColor('#0f172a').font('Helvetica').fontSize(10).text(String(value || '-'), x, y + 11, { width }); };
  addHeader();
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(15).text(audit.hospital?.facilityName || 'Hospital Audit', { align: 'center' });
  doc.fillColor('#64748b').font('Helvetica').fontSize(9).text(`Report generated ${new Date().toLocaleString('en-IN')}`, { align: 'center' });
  section('Audit & Hospital Overview');
  const overviewY = doc.y;
  field('Audit status', audit.status, 48, overviewY, 220); field('Target date', audit.targetDate ? new Date(audit.targetDate).toLocaleDateString('en-IN') : '-', 300, overviewY, 230);
  field('Facility ID', audit.hospital?.facilityId, 48, overviewY + 35, 220); field('District / State', `${audit.hospital?.district || '-'} / ${audit.hospital?.state || 'Bihar'}`, 300, overviewY + 35, 230);
  doc.y = overviewY + 112;
  section('Assigned Team');
  const scheduleY = doc.y;
  field('Assigned team', assignment?.team?.teamName, 48, scheduleY, 220); field('Team Lead', assignment?.acknowledgedBy?.name || assignment?.team?.teamLead?.name || assignment?.team?.teamLeadEmail, 300, scheduleY, 230);
  doc.y = scheduleY + 42;
  section('Hospital Assessment');
  const assessmentColor = audit.isSuspicious ? '#b91c1c' : '#15803d';
  doc.roundedRect(48, doc.y, 499, 58, 5).fill(audit.isSuspicious ? '#fef2f2' : '#f0fdf4');
  doc.fillColor(assessmentColor).font('Helvetica-Bold').fontSize(14).text(audit.isSuspicious ? 'SUSPICIOUS HOSPITAL' : 'NOT SUSPICIOUS', 64, doc.y + 13);
  doc.fillColor('#334155').font('Helvetica').fontSize(9).text(audit.suspicionRemarks || 'No additional remarks recorded.', 64, doc.y + 34, { width: 460 });
  doc.y += 72;
  /* Legacy checklist, findings, and evidence data intentionally omitted from the simplified report.
  const responses = auditResponse?.responses || []; const templateQuestions = auditResponse?.template?.sections?.flatMap((sectionItem) => sectionItem.questions || []) || [];
  doc.fillColor('#0f172a').font('Helvetica').fontSize(10).text(`Status: ${auditResponse?.isComplete ? 'Completed' : 'Not completed'}     Responses recorded: ${responses.length}/${templateQuestions.length}`);
  responses.forEach((response, index) => { needSpace(42); const question = templateQuestions.find((item) => item.questionId === response.questionId); doc.fillColor('#334155').font('Helvetica-Bold').fontSize(9).text(`${index + 1}. ${question?.text || response.questionId}`); doc.fillColor('#0f172a').font('Helvetica').fontSize(9).text(`Response: ${response.responseValue || '-'}${response.remarks ? ` | Remarks: ${response.remarks}` : ''}`); });
  section(`Findings (${findings.length})`);
  if (!findings.length) doc.fillColor('#64748b').font('Helvetica').fontSize(10).text('No findings were recorded.');
  findings.forEach((finding, index) => { needSpace(66); const color = finding.severity === 'Critical' ? '#b91c1c' : finding.severity === 'High' ? '#c2410c' : '#1d4ed8'; doc.roundedRect(48, doc.y, 499, 54, 4).fill('#f8fafc'); doc.fillColor(color).font('Helvetica-Bold').fontSize(9).text(`${index + 1}. ${finding.severity} — ${finding.category}`, 60, doc.y + 10); doc.fillColor('#0f172a').font('Helvetica').fontSize(9).text(finding.observation || '-', 60, doc.y + 23, { width: 470, height: 15 }); if (finding.recommendation) doc.fillColor('#475569').fontSize(8).text(`Recommendation: ${finding.recommendation}`, 60, doc.y + 37, { width: 470 }); doc.y += 60; });
  section(`Evidence Register (${evidence.length})`);
  if (!evidence.length) doc.fillColor('#64748b').font('Helvetica').fontSize(10).text('No evidence files were uploaded.');
  evidence.forEach((item, index) => { needSpace(190); doc.fillColor('#1e3a8a').font('Helvetica-Bold').fontSize(10).text(`${index + 1}. ${item.originalName || 'Evidence file'}`); doc.fillColor('#475569').font('Helvetica').fontSize(8).text(`${item.fileType || 'file'}  •  ${item.uploadedAt ? new Date(item.uploadedAt).toLocaleString('en-IN') : '-'}${item.description ? `  •  ${item.description}` : ''}`); const imagePath = item.storageKey ? path.join(__dirname, '../../..', item.storageKey) : null; if (imagePath && /^image\/(jpeg|png)$/i.test(item.fileType || '') && fs.existsSync(imagePath)) { try { doc.moveDown(0.5); doc.image(imagePath, { fit: [360, 145], align: 'center' }); doc.moveDown(0.5); } catch { doc.fillColor('#64748b').fontSize(8).text('Image preview could not be embedded; file remains available in HMAS.'); } } else { doc.moveDown(0.5); doc.fillColor('#64748b').fontSize(8).text('Preview unavailable for this file type. Download the file from the Evidence section in HMAS.'); doc.moveDown(0.5); } });
  */
  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) { doc.switchToPage(index); doc.fillColor('#64748b').font('Helvetica').fontSize(8).text(`HMAS • ${audit.auditNumber} • Page ${index + 1} of ${range.count}`, 48, 800, { width: pageWidth, align: 'center' }); }
  doc.end();
};

// GET /api/v1/reports/:auditId/evidence-package
const downloadEvidencePackage = async (req, res) => {
  const audit = await Audit.findById(req.params.auditId).populate('hospital', 'facilityName facilityId district state');
  if (!audit) return res.status(404).json({ success: false, message: 'Audit not found.' });
  const evidence = await Evidence.find({ audit: audit._id }).sort({ uploadedAt: 1 });
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${audit.auditNumber.replace(/[^a-z0-9-_]/gi, '_')}-evidence.zip"`);
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (error) => { if (!res.headersSent) res.status(500).json({ success: false, message: error.message }); else res.destroy(error); });
  archive.pipe(res);
  archive.append(JSON.stringify({ auditNumber: audit.auditNumber, hospital: audit.hospital, generatedAt: new Date().toISOString(), evidence: evidence.map((item) => ({ originalName: item.originalName, fileType: item.fileType, description: item.description, uploadedAt: item.uploadedAt })) }, null, 2), { name: 'README.json' });
  evidence.forEach((item, index) => {
    const filePath = item.storageKey ? path.join(__dirname, '../../..', item.storageKey) : null;
    const safeName = String(item.originalName || item.filename || `evidence-${index + 1}`).replace(/[\\/:*?"<>|]/g, '_');
    if (filePath && fs.existsSync(filePath)) archive.file(filePath, { name: `evidence/${String(index + 1).padStart(2, '0')}-${safeName}` });
  });
  await archive.finalize();
};

// GET /api/v1/reports/:auditId
const getReport = async (req, res) => {
  const { auditId } = req.params;

  const audit = await Audit.findById(auditId).populate('hospital', 'facilityId facilityName district state');
  if (!audit) {
    return res.status(404).json({ success: false, message: 'Audit not found.' });
  }

  const report = await AuditReport.findOne({ audit: auditId })
    .populate('versions.submittedBy', 'name email role')
    .populate('versions.reviewedBy', 'name email role')
    .populate('approvedBy', 'name email')
    .populate('closedBy', 'name email');

  return res.status(200).json({ success: true, audit, report: report || null });
};

// POST /api/v1/reports/:auditId/complete  (team lead)
const completeAudit = async (req, res) => {
  const { auditId } = req.params;

  const audit = await Audit.findById(auditId).populate('hospital');
  if (!audit) {
    return res.status(404).json({ success: false, message: 'Audit not found.' });
  }
  if (!(await teamLeadOwnsAudit(req.user._id, auditId))) {
    return res.status(403).json({ success: false, message: 'Not authorized for this audit.' });
  }

  if (audit.status !== 'IN_PROGRESS') {
    return res.status(400).json({ success: false, message: 'Audit must be IN_PROGRESS to mark as complete.' });
  }

  if (typeof audit.isSuspicious !== 'boolean') return res.status(400).json({ success: false, message: 'Mark the hospital as suspicious or not suspicious before completing the audit.' });

  audit.status = 'COMPLETED';
  audit.statusHistory.push({ status: 'COMPLETED', changedBy: req.user._id, changedAt: new Date() });
  audit.activityTimeline.push({
    action: 'AUDIT_COMPLETED',
    performedBy: req.user._id,
    performedByRole: req.user.role,
    timestamp: new Date(),
    details: { isSuspicious: audit.isSuspicious },
  });
  await audit.save();

  // Get assignment to build report
  const assignment = await Assignment.findOne({ audit: auditId, status: { $nin: ['REASSIGNED', 'CANCELLED'] } })
    .populate({ path: 'team', select: 'teamId teamName teamLeadEmail teamLead', populate: { path: 'teamLead', select: 'name email' } })
    .populate('acknowledgedBy', 'name email');

  // Create or update report as draft
  let report = await AuditReport.findOne({ audit: auditId });

  const reportData = {
    auditNumber: audit.auditNumber,
    hospital: audit.hospital,
    assessment: { isSuspicious: audit.isSuspicious, remarks: audit.suspicionRemarks },
    team: assignment?.team ? { teamId: assignment.team.teamId, teamName: assignment.team.teamName, teamLeadName: assignment.acknowledgedBy?.name || assignment.team.teamLead?.name || null, teamLeadEmail: assignment.acknowledgedBy?.email || assignment.team.teamLead?.email || assignment.team.teamLeadEmail } : null,
    completedAt: new Date(),
  };

  if (!report) {
    report = await AuditReport.create({
      audit: auditId,
      assignment: assignment?._id,
      versions: [
        {
          version: 1,
          submittedBy: req.user._id,
          submittedAt: new Date(),
          status: 'DRAFT',
          reportData,
        },
      ],
      currentVersion: 1,
      currentStatus: 'DRAFT',
    });
  } else {
    report.versions[report.currentVersion - 1].reportData = reportData;
    report.currentStatus = 'DRAFT';
    await report.save();
  }

  return res.status(200).json({
    success: true,
    message: 'Audit marked as complete. Ready for report submission.',
    audit,
    report,
  });
};

// POST /api/v1/reports/:auditId/submit  (team lead)
const submitReport = async (req, res) => {
  const { auditId } = req.params;
  const { remarks } = req.body;

  const audit = await Audit.findById(auditId).populate('hospital');
  if (!audit) {
    return res.status(404).json({ success: false, message: 'Audit not found.' });
  }
  if (!(await teamLeadOwnsAudit(req.user._id, auditId))) {
    return res.status(403).json({ success: false, message: 'Not authorized for this audit.' });
  }

  const SUBMITTABLE_STATUSES = ['COMPLETED', 'RETURNED'];
  if (!SUBMITTABLE_STATUSES.includes(audit.status)) {
    return res.status(400).json({
      success: false,
      message: `Audit must be COMPLETED or RETURNED to submit report. Current: ${audit.status}`,
    });
  }

  let report = await AuditReport.findOne({ audit: auditId });
  if (!report) {
    return res.status(404).json({ success: false, message: 'Report not found. Mark audit as complete first.' });
  }

  // Create new version if resubmitting
  const newVersion = report.currentVersion + (audit.status === 'RETURNED' ? 1 : 0);

  if (audit.status === 'RETURNED') {
    const findings = await Finding.find({ audit: auditId });
    const auditResponse = await AuditResponse.findOne({ audit: auditId });

    report.versions.push({
      version: newVersion,
      submittedBy: req.user._id,
      submittedAt: new Date(),
      status: 'SUBMITTED',
      reportData: {
        auditNumber: audit.auditNumber,
        hospital: audit.hospital,
        findingCount: findings.length,
        checklistComplete: auditResponse?.isComplete || false,
        remarks,
        submittedAt: new Date(),
      },
    });
    report.currentVersion = newVersion;
  } else {
    report.versions[report.currentVersion - 1].status = 'SUBMITTED';
    report.versions[report.currentVersion - 1].submittedBy = req.user._id;
    report.versions[report.currentVersion - 1].submittedAt = new Date();
  }

  report.currentStatus = 'SUBMITTED';
  await report.save();

  audit.status = 'SUBMITTED';
  audit.statusHistory.push({ status: 'SUBMITTED', changedBy: req.user._id, changedAt: new Date() });
  audit.activityTimeline.push({
    action: 'REPORT_SUBMITTED',
    performedBy: req.user._id,
    performedByRole: req.user.role,
    timestamp: new Date(),
    details: { version: report.currentVersion, remarks },
  });
  await audit.save();

  // Notify all admins
  const admins = await User.find({ role: 'ADMIN', isActive: true }).select('_id');
  await Promise.all(
    admins.map((admin) =>
      notifyReportSubmitted(admin._id, audit.auditNumber, audit.hospital.facilityName, report._id)
    )
  );

  return res.status(200).json({ success: true, message: 'Report submitted for review.', report });
};

// POST /api/v1/reports/:auditId/return  (admin)
const returnReport = async (req, res) => {
  const { auditId } = req.params;
  const { comments } = req.body;

  if (!comments || comments.trim().length < 10) {
    return res.status(400).json({ success: false, message: 'Review comments (min 10 chars) are required.' });
  }

  const audit = await Audit.findById(auditId).populate('hospital');
  if (!audit) {
    return res.status(404).json({ success: false, message: 'Audit not found.' });
  }

  if (audit.status !== 'SUBMITTED') {
    return res.status(400).json({ success: false, message: 'Audit must be SUBMITTED to return.' });
  }

  const report = await AuditReport.findOne({ audit: auditId });
  if (!report) {
    return res.status(404).json({ success: false, message: 'Report not found.' });
  }

  const currentVersionDoc = report.versions[report.currentVersion - 1];
  currentVersionDoc.status = 'RETURNED';
  currentVersionDoc.reviewComments = comments;
  currentVersionDoc.reviewedBy = req.user._id;
  currentVersionDoc.reviewedAt = new Date();
  report.currentStatus = 'RETURNED';
  await report.save();

  audit.status = 'RETURNED';
  audit.statusHistory.push({ status: 'RETURNED', changedBy: req.user._id, changedAt: new Date() });
  audit.activityTimeline.push({
    action: 'REPORT_RETURNED',
    performedBy: req.user._id,
    performedByRole: req.user.role,
    timestamp: new Date(),
    details: { comments, version: report.currentVersion },
  });
  await audit.save();

  // Notify team lead
  const assignment = await Assignment.findOne({ audit: auditId, status: 'ACCEPTED' }).populate('team');
  if (assignment && assignment.team && assignment.team.teamLead) {
    await notifyReportReturned(
      assignment.team.teamLead,
      audit.auditNumber,
      comments,
      report._id
    );
  }

  return res.status(200).json({ success: true, message: 'Report returned with comments.', report });
};

// POST /api/v1/reports/:auditId/approve  (admin)
const approveReport = async (req, res) => {
  const { auditId } = req.params;

  const audit = await Audit.findById(auditId).populate('hospital');
  if (!audit) {
    return res.status(404).json({ success: false, message: 'Audit not found.' });
  }

  if (audit.status !== 'SUBMITTED') {
    return res.status(400).json({ success: false, message: 'Audit must be SUBMITTED to approve.' });
  }

  const report = await AuditReport.findOne({ audit: auditId });
  if (!report) {
    return res.status(404).json({ success: false, message: 'Report not found.' });
  }

  const currentVersionDoc = report.versions[report.currentVersion - 1];
  currentVersionDoc.status = 'APPROVED';
  currentVersionDoc.reviewedBy = req.user._id;
  currentVersionDoc.reviewedAt = new Date();

  report.currentStatus = 'APPROVED';
  report.approvedBy = req.user._id;
  report.approvedAt = new Date();
  report.closedBy = req.user._id;
  report.closedAt = new Date();
  await report.save();

  audit.status = 'CLOSED';
  audit.statusHistory.push(
    { status: 'APPROVED', changedBy: req.user._id, changedAt: new Date() },
    { status: 'CLOSED', changedBy: req.user._id, changedAt: new Date() }
  );
  audit.activityTimeline.push({
    action: 'REPORT_APPROVED',
    performedBy: req.user._id,
    performedByRole: req.user.role,
    timestamp: new Date(),
    details: { version: report.currentVersion },
  });
  await audit.save();

  // Update hospital last audit details
  await require('../models/Hospital').findByIdAndUpdate(audit.hospital._id, {
    lastAuditDate: new Date(),
    lastAuditResult: 'Completed',
    nextAuditDue: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
  });

  // Notify team lead
  const assignment = await Assignment.findOne({ audit: auditId, status: 'ACCEPTED' }).populate('team');
  if (assignment && assignment.team && assignment.team.teamLead) {
    await notifyReportApproved(assignment.team.teamLead, audit.auditNumber, report._id);
  }

  await logAction({
    userId: req.user._id,
    userRole: req.user.role,
    action: 'REPORT_APPROVED',
    entity: 'AuditReport',
    entityId: report._id,
    newValue: { auditNumber: audit.auditNumber, version: report.currentVersion },
    req,
  });

  return res.status(200).json({ success: true, message: 'Report approved. Audit closed.', report, audit });
};

// POST /api/v1/reports/:auditId/reopen  (admin)
const reopenAudit = async (req, res) => {
  const { auditId } = req.params;
  const { reason } = req.body;

  if (!reason || reason.trim().length < 10) {
    return res.status(400).json({ success: false, message: 'A detailed reason (min 10 chars) is required to reopen.' });
  }

  const audit = await Audit.findById(auditId);
  if (!audit) {
    return res.status(404).json({ success: false, message: 'Audit not found.' });
  }

  const REOPENABLE_STATUSES = ['CLOSED', 'APPROVED'];
  if (!REOPENABLE_STATUSES.includes(audit.status)) {
    return res.status(400).json({ success: false, message: `Audit in '${audit.status}' cannot be reopened.` });
  }

  const oldStatus = audit.status;
  audit.status = 'IN_PROGRESS';
  audit.statusHistory.push({ status: 'IN_PROGRESS', changedBy: req.user._id, changedAt: new Date(), reason });
  audit.activityTimeline.push({
    action: 'AUDIT_REOPENED',
    performedBy: req.user._id,
    performedByRole: req.user.role,
    timestamp: new Date(),
    details: { reason, previousStatus: oldStatus },
  });
  await audit.save();

  // Reset report status to DRAFT
  const report = await AuditReport.findOne({ audit: auditId });
  if (report) {
    report.currentStatus = 'DRAFT';
    report.closedBy = undefined;
    report.closedAt = undefined;
    await report.save();
  }

  await logAction({
    userId: req.user._id,
    userRole: req.user.role,
    action: 'AUDIT_REOPENED',
    entity: 'Audit',
    entityId: audit._id,
    oldValue: { status: oldStatus },
    newValue: { status: 'IN_PROGRESS' },
    reason,
    req,
  });

  return res.status(200).json({ success: true, message: 'Audit reopened.', audit });
};

// POST /api/v1/reports/:auditId/upload  (team lead)
const multer = require('multer');
const reportStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../../uploads/reports');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `report-${req.params.auditId}-${Date.now()}${ext}`);
  },
});
const reportUpload = multer({
  storage: reportStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.xlsx', '.xls', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF, Excel, and Word files are supported.'));
  },
  limits: { fileSize: 25 * 1024 * 1024 },
});

const uploadReport = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });

  const audit = await Audit.findById(req.params.auditId);
  if (!audit) return res.status(404).json({ success: false, message: 'Audit not found.' });

  const allowed = ['IN_PROGRESS', 'COMPLETED', 'RETURNED'];
  if (!allowed.includes(audit.status)) {
    return res.status(400).json({ success: false, message: `Cannot upload report in ${audit.status} status.` });
  }

  let report = await AuditReport.findOne({ audit: audit._id });
  if (!report) {
    report = await AuditReport.create({
      audit: audit._id,
      currentVersion: 1,
      currentStatus: 'DRAFT',
      versions: [{ version: 1, status: 'DRAFT', createdAt: new Date() }],
    });
  }

  // Store uploaded file info
  report.uploadedFile = {
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    uploadedBy: req.user._id,
    uploadedAt: new Date(),
  };
  await report.save();

  await logAction({
    userId: req.user._id, userRole: req.user.role,
    action: 'REPORT_UPLOADED', entity: 'AuditReport', entityId: report._id,
    newValue: { filename: req.file.originalname, size: req.file.size },
    req,
  });

  return res.status(200).json({
    success: true,
    message: 'Report file uploaded successfully.',
    file: { filename: req.file.filename, originalName: req.file.originalname, size: req.file.size },
  });
};

// GET /api/v1/reports/:auditId/download-file
const downloadReportFile = async (req, res) => {
  const report = await AuditReport.findOne({ audit: req.params.auditId });
  if (!report || !report.uploadedFile?.filename) {
    return res.status(404).json({ success: false, message: 'No uploaded report file found.' });
  }
  const filePath = path.join(__dirname, '../../../uploads/reports', report.uploadedFile.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'File not found on server.' });
  }
  res.download(filePath, report.uploadedFile.originalName);
};

module.exports = {
  getReport,
  downloadReportPdf,
  downloadEvidencePackage,
  completeAudit,
  submitReport,
  returnReport,
  approveReport,
  reopenAudit,
  reportUpload,
  uploadReport,
  downloadReportFile,
};
