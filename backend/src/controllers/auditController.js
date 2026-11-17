const Audit = require('../models/Audit');
const Hospital = require('../models/Hospital');
const Assignment = require('../models/Assignment');
const AuditSchedule = require('../models/AuditSchedule');
const Finding = require('../models/Finding');
const Evidence = require('../models/Evidence');
const AuditReport = require('../models/AuditReport');
const AuditResponse = require('../models/AuditResponse');
const PDFDocument = require('pdfkit');
const { generateAuditNumber } = require('../utils/generateId');
const { logAction } = require('../utils/auditLogger');

// GET /api/v1/audits
const getAudits = async (req, res) => {
  const {
    status,
    hospital,
    auditType,
    priority,
    batchId,
    fromDate,
    toDate,
    search,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query;

  const filter = {};

  if (status) {
    const statuses = status.split(',').map((s) => s.trim());
    filter.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
  }
  if (hospital) filter.hospital = hospital;
  if (auditType) filter.auditType = auditType;
  if (priority) filter.priority = priority;
  if (batchId) filter.auditBatchId = batchId;

  if (fromDate || toDate) {
    filter.createdAt = {};
    if (fromDate) filter.createdAt.$gte = new Date(fromDate);
    if (toDate) filter.createdAt.$lte = new Date(toDate);
  }

  if (search) {
    filter.$or = [
      { auditNumber: { $regex: search, $options: 'i' } },
    ];
  }

  // Team leads can only see their team's audits
  if (req.user.role === 'TEAM_LEAD') {
    const Team = require('../models/Team');
    const team = await Team.findOne({ teamLead: req.user._id, isActive: true });
    if (team) {
      const assignments = await Assignment.find({ team: team._id, status: { $nin: ['REASSIGNED', 'CANCELLED'] } }).distinct('audit');
      filter._id = { $in: assignments };
    } else {
      // No team — return empty
      return res.status(200).json({ success: true, total: 0, page: 1, pages: 0, audits: [] });
    }
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sortDir = sortOrder === 'asc' ? 1 : -1;

  const [audits, total] = await Promise.all([
    Audit.find(filter)
      .populate('hospital', 'facilityId facilityName district state')
      .populate('createdBy', 'name email')
      .sort({ [sortBy]: sortDir })
      .skip(skip)
      .limit(parseInt(limit)),
    Audit.countDocuments(filter),
  ]);

  // Attach the current team so the admin list and exports reflect operational ownership.
  let assignmentByAudit = new Map();
  let reportByAudit = new Map();
  if (req.user.role === 'ADMIN' && audits.length) {
    const [assignments, reports] = await Promise.all([
      Assignment.find({ audit: { $in: audits.map((audit) => audit._id) }, status: { $nin: ['REASSIGNED', 'CANCELLED'] } })
        .populate('team', 'teamId teamName')
        .select('audit team'),
      AuditReport.find({ audit: { $in: audits.map((audit) => audit._id) } }).select('audit currentVersion currentStatus versions approvedAt closedAt'),
    ]);
    assignmentByAudit = new Map(assignments.map((assignment) => [assignment.audit.toString(), assignment]));
    reportByAudit = new Map(reports.map((report) => [report.audit.toString(), report]));
  }
  if (req.user.role === 'TEAM_LEAD' && audits.length) {
    const reports = await AuditReport.find({ audit: { $in: audits.map((audit) => audit._id) } }).select('audit currentVersion currentStatus versions');
    reportByAudit = new Map(reports.map((report) => [report.audit.toString(), report]));
  }

  return res.status(200).json({
    success: true,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    audits: audits.map((audit) => ({ ...audit.toObject(), currentAssignment: assignmentByAudit.get(audit._id.toString()) || null, report: reportByAudit.get(audit._id.toString()) || null })),
  });
};

// GET /api/v1/audits/batches (admin only)
const getAuditBatches = async (req, res) => {
  const audits = await Audit.find({ auditBatchId: { $exists: true, $ne: null } })
    .populate('hospital', 'facilityName district state')
    .sort({ createdAt: -1 });
  const assignments = await Assignment.find({ audit: { $in: audits.map((audit) => audit._id) }, status: { $nin: ['REASSIGNED', 'CANCELLED'] } }).populate('team', 'teamName');
  const assignmentMap = new Map(assignments.map((assignment) => [assignment.audit.toString(), assignment]));
  const batches = new Map();
  audits.forEach((audit) => {
    const key = audit.auditBatchId;
    if (!batches.has(key)) batches.set(key, { batchId: key, createdAt: audit.createdAt, auditType: audit.auditType, priority: audit.priority, hospitals: [], statusCounts: {}, assignedCount: 0, completedCount: 0 });
    const batch = batches.get(key); const assignment = assignmentMap.get(audit._id.toString());
    batch.hospitals.push({ auditId: audit._id, auditNumber: audit.auditNumber, hospital: audit.hospital, status: audit.status, team: assignment?.team || null });
    batch.statusCounts[audit.status] = (batch.statusCounts[audit.status] || 0) + 1;
    if (assignment) batch.assignedCount += 1;
    if (['APPROVED', 'CLOSED'].includes(audit.status)) batch.completedCount += 1;
  });
  return res.status(200).json({ success: true, batches: [...batches.values()] });
};

// GET /api/v1/audits/:id
const getAudit = async (req, res) => {
  const audit = await Audit.findById(req.params.id)
    .populate('hospital')
    .populate('createdBy', 'name email role');

  if (!audit) {
    return res.status(404).json({ success: false, message: 'Audit not found.' });
  }

  if (req.user.role === 'TEAM_LEAD') {
    const Team = require('../models/Team');
    const team = await Team.findOne({ teamLead: req.user._id, isActive: true });
    const isAssigned = team && await Assignment.exists({ audit: audit._id, team: team._id, status: { $nin: ['REASSIGNED', 'CANCELLED'] } });
    if (!isAssigned) return res.status(403).json({ success: false, message: 'Not authorized to view this audit.' });
  }

  const [assignment, schedule, findings, evidence, report, checklist] = await Promise.all([
    Assignment.findOne({ audit: audit._id, status: { $nin: ['REASSIGNED', 'CANCELLED'] } })
      .populate('team', 'teamId teamName teamLeadEmail')
      .populate('assignedBy', 'name email')
      .populate('acknowledgedBy', 'name email'),
    AuditSchedule.findOne({ audit: audit._id, status: { $ne: 'CANCELLED' } }),
    Finding.find({ audit: audit._id }).populate('createdBy', 'name'),
    Evidence.find({ audit: audit._id }).populate('uploadedBy', 'name email').sort({ uploadedAt: -1 }),
    AuditReport.findOne({ audit: audit._id })
      .populate('versions.submittedBy', 'name email')
      .populate('versions.reviewedBy', 'name email'),
    AuditResponse.findOne({ audit: audit._id }).populate('template'),
  ]);

  return res.status(200).json({
    success: true,
    audit,
    assignment: assignment || null,
    schedule: schedule || null,
    findings,
    evidence: evidence.map((item) => ({ ...item.toObject(), downloadUrl: `/api/v1/audits/${audit._id}/evidence/${item._id}/download` })),
    report: report || null,
    checklist: checklist ? { ...checklist.toObject(), template: checklist.templateSnapshot || checklist.template } : null,
  });
};

// POST /api/v1/audits/:id/assessment (team lead)
const saveAuditAssessment = async (req, res) => {
  const audit = await Audit.findById(req.params.id);
  if (!audit) return res.status(404).json({ success: false, message: 'Audit not found.' });
  if (!['IN_PROGRESS'].includes(audit.status)) return res.status(400).json({ success: false, message: 'Start the audit before saving the assessment.' });
  if (typeof req.body.isSuspicious !== 'boolean') return res.status(400).json({ success: false, message: 'isSuspicious must be true or false.' });
  audit.isSuspicious = req.body.isSuspicious;
  audit.suspicionRemarks = req.body.remarks || '';
  audit.activityTimeline.push({ action: 'SUSPICION_ASSESSMENT_RECORDED', performedBy: req.user._id, performedByRole: req.user.role, timestamp: new Date(), details: { isSuspicious: audit.isSuspicious, remarks: audit.suspicionRemarks } });
  await audit.save();
  return res.status(200).json({ success: true, message: 'Assessment saved.', audit });
};

// GET /api/v1/audits/:id/order-pdf
const downloadAuditOrderPdf = async (req, res) => {
  const audit = await Audit.findById(req.params.id).populate('hospital', 'facilityName facilityId district state address nodalOfficerName nodalOfficerNumber');
  if (!audit) return res.status(404).json({ success: false, message: 'Audit not found.' });
  const assignment = await Assignment.findOne({ audit: audit._id, status: { $nin: ['REASSIGNED', 'CANCELLED'] } }).populate({ path: 'team', select: 'teamName teamLead', populate: { path: 'teamLead', select: 'name email' } });
  if (req.user.role === 'TEAM_LEAD' && assignment?.status !== 'ACCEPTED') {
    return res.status(403).json({ success: false, message: 'Accept the assignment before downloading the audit order.' });
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${audit.auditNumber.replace(/[^a-z0-9-_]/gi, '_')}-audit-order.pdf"`);
  const doc = new PDFDocument({ size: 'A4', margin: 54 }); doc.pipe(res);
  doc.rect(54, 46, 487, 58).fill('#1e3a8a'); doc.fillColor('#fff').font('Helvetica-Bold').fontSize(18).text('AUDIT ASSIGNMENT ORDER', 72, 64); doc.font('Helvetica').fontSize(9).text('Hospital Audit Management System (HMAS)', 72, 86);
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(12).text(`Audit No.: ${audit.auditNumber}`, 54, 132); doc.font('Helvetica').fontSize(10).text(`Issued: ${new Date(audit.createdAt).toLocaleString('en-IN')}`);
  const section = (title) => { doc.moveDown(1.4).fillColor('#1e3a8a').font('Helvetica-Bold').fontSize(11).text(title); doc.moveTo(54, doc.y + 4).lineTo(541, doc.y + 4).strokeColor('#bfdbfe').stroke(); doc.moveDown(0.7); };
  const row = (label, value) => { doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(9).text(`${label}: `, { continued: true }); doc.fillColor('#0f172a').font('Helvetica').text(value || '-'); doc.moveDown(0.35); };
  section('Hospital'); row('Name', audit.hospital?.facilityName); row('Facility ID', audit.hospital?.facilityId); row('District / State', `${audit.hospital?.district || '-'} / Bihar`); row('Address', audit.hospital?.address); row('Nodal officer', `${audit.hospital?.nodalOfficerName || '-'} ${audit.hospital?.nodalOfficerNumber ? `(${audit.hospital.nodalOfficerNumber})` : ''}`);
  section('Assignment'); row('Assigned team', assignment?.team?.teamName); row('Team Lead', assignment?.team?.teamLead?.name || assignment?.team?.teamLead?.email); row('Target date', audit.targetDate ? new Date(audit.targetDate).toLocaleDateString('en-IN') : '-');
  section('Instructions'); doc.fillColor('#0f172a').font('Helvetica').fontSize(10).text(audit.instructions || audit.reason || 'Conduct the hospital audit and submit the suspicious/not-suspicious assessment by the end of the day.', { lineGap: 4 });
  doc.moveDown(3).fillColor('#334155').font('Helvetica-Oblique').fontSize(9).text('This is a system-generated audit assignment order. The Team Lead should accept the assignment in HMAS before starting the audit.');
  doc.end();
};

// POST /api/v1/audits  (admin only)
const createAudit = async (req, res) => {
  const { hospital: hospitalId, hospitalIds, reason, targetDate, instructions } = req.body;
  const requestedHospitalIds = Array.isArray(hospitalIds) && hospitalIds.length
    ? [...new Set(hospitalIds)]
    : hospitalId ? [hospitalId] : [];

  if (!requestedHospitalIds.length) {
    return res.status(400).json({ success: false, message: 'One hospital is required.' });
  }

  if (requestedHospitalIds.length > 1) {
    return res.status(400).json({ success: false, message: 'Create one audit for one hospital at a time.' });
  }

  const hospitals = await Hospital.find({ _id: { $in: requestedHospitalIds } });
  if (hospitals.length !== requestedHospitalIds.length) {
    return res.status(404).json({ success: false, message: 'One or more hospitals were not found.' });
  }
  const inactiveHospital = hospitals.find((hospital) => !hospital.isActive);
  if (inactiveHospital) return res.status(400).json({ success: false, message: `Cannot create audit for inactive hospital '${inactiveHospital.facilityName}'.` });

  const audits = [];
  for (const hospital of hospitals) {
    const stateCode = (hospital.state || 'XX').replace(/\s+/g, '').substring(0, 3).toUpperCase();
    const districtCode = (hospital.district || 'XXX').replace(/\s+/g, '').substring(0, 3).toUpperCase();
    let audit;
    for (let attempt = 0; attempt < 3 && !audit; attempt += 1) {
      const auditNumber = await generateAuditNumber(stateCode, districtCode);
      try {
        audit = await Audit.create({
          auditNumber, hospital: hospital._id, reason, targetDate, instructions,
          status: 'PLANNED', createdBy: req.user._id,
          statusHistory: [{ status: 'PLANNED', changedBy: req.user._id, changedAt: new Date() }],
          activityTimeline: [{ action: 'AUDIT_CREATED', performedBy: req.user._id, performedByRole: req.user.role, timestamp: new Date(), details: { auditNumber, hospitalName: hospital.facilityName } }],
        });
      } catch (error) {
        if (error?.code !== 11000 || attempt === 2) throw error;
      }
    }
    audits.push(audit);
  }

  await Promise.all(audits.map((audit) => audit.populate(['hospital', 'createdBy'])));

  await logAction({
    userId: req.user._id,
    userRole: req.user.role,
    action: 'AUDIT_CREATED',
    entity: 'Audit',
    entityId: audits[0]._id,
    newValue: { auditNumbers: audits.map((audit) => audit.auditNumber), hospitalCount: audits.length },
    req,
  });

  return res.status(201).json({
    success: true,
    message: `${audits.length} audit(s) created.`,
    hospitalCount: audits.length,
    createdHospitalIds: audits.map((audit) => audit.hospital?._id?.toString() || audit.hospital?.toString()),
    audit: audits[0],
    audits,
  });
};

// PUT /api/v1/audits/:id  (admin only)
const updateAudit = async (req, res) => {
  const audit = await Audit.findById(req.params.id);
  if (!audit) {
    return res.status(404).json({ success: false, message: 'Audit not found.' });
  }

  const LOCKED_STATUSES = ['COMPLETED', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'CLOSED', 'CANCELLED'];
  if (LOCKED_STATUSES.includes(audit.status)) {
    return res.status(400).json({ success: false, message: `Cannot update audit in '${audit.status}' status.` });
  }

  const allowedFields = ['reason', 'targetDate', 'instructions'];
  const oldValue = {};
  const updates = {};

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      oldValue[field] = audit[field];
      updates[field] = req.body[field];
      audit[field] = req.body[field];
    }
  }

  audit.activityTimeline.push({
    action: 'AUDIT_UPDATED',
    performedBy: req.user._id,
    performedByRole: req.user.role,
    timestamp: new Date(),
    details: { updatedFields: Object.keys(updates) },
  });

  await audit.save();

  await logAction({
    userId: req.user._id,
    userRole: req.user.role,
    action: 'AUDIT_UPDATED',
    entity: 'Audit',
    entityId: audit._id,
    oldValue,
    newValue: updates,
    req,
  });

  return res.status(200).json({ success: true, message: 'Audit updated.', audit });
};

// POST /api/v1/audits/:id/cancel  (admin only)
const cancelAudit = async (req, res) => {
  const { reason } = req.body;

  if (!reason || reason.trim().length < 10) {
    return res.status(400).json({ success: false, message: 'A reason (min 10 characters) is required to cancel an audit.' });
  }

  const audit = await Audit.findById(req.params.id);
  if (!audit) {
    return res.status(404).json({ success: false, message: 'Audit not found.' });
  }

  const NON_CANCELLABLE = ['CANCELLED', 'CLOSED', 'APPROVED'];
  if (NON_CANCELLABLE.includes(audit.status)) {
    return res.status(400).json({ success: false, message: `Audit in '${audit.status}' cannot be cancelled.` });
  }

  const oldStatus = audit.status;
  audit.status = 'CANCELLED';
  audit.statusHistory.push({ status: 'CANCELLED', changedBy: req.user._id, changedAt: new Date(), reason });
  audit.activityTimeline.push({
    action: 'AUDIT_CANCELLED',
    performedBy: req.user._id,
    performedByRole: req.user.role,
    timestamp: new Date(),
    details: { reason, previousStatus: oldStatus },
  });

  await audit.save();

  // Cancel active assignments
  const activeAssignment = await Assignment.findOne({ audit: audit._id, status: { $in: ['PENDING', 'ACCEPTED'] } });
  if (activeAssignment) {
    activeAssignment.status = 'CANCELLED';
    await activeAssignment.save();

    // Notify team lead
    const Team = require('../models/Team');
    const team = await Team.findById(activeAssignment.team);
    if (team && team.teamLead) {
      const { notifyAuditCancelled } = require('../utils/notificationService');
      await notifyAuditCancelled(team.teamLead, audit.auditNumber, reason, audit._id);
    }
  }

  await logAction({
    userId: req.user._id,
    userRole: req.user.role,
    action: 'AUDIT_CANCELLED',
    entity: 'Audit',
    entityId: audit._id,
    oldValue: { status: oldStatus },
    newValue: { status: 'CANCELLED' },
    reason,
    req,
  });

  return res.status(200).json({ success: true, message: 'Audit cancelled.', audit });
};

// POST /api/v1/audits/:id/hold  (admin only)
const holdAudit = async (req, res) => {
  const { reason } = req.body;

  if (!reason) {
    return res.status(400).json({ success: false, message: 'Reason is required to put audit on hold.' });
  }

  const audit = await Audit.findById(req.params.id);
  if (!audit) {
    return res.status(404).json({ success: false, message: 'Audit not found.' });
  }

  const HOLDABLE_STATUSES = ['PLANNED', 'UNASSIGNED', 'ASSIGNED', 'AWAITING_ACKNOWLEDGEMENT', 'ACCEPTED', 'SCHEDULED'];
  if (!HOLDABLE_STATUSES.includes(audit.status)) {
    return res.status(400).json({ success: false, message: `Audit in '${audit.status}' cannot be put on hold.` });
  }

  const oldStatus = audit.status;
  audit.status = 'ON_HOLD';
  audit.statusHistory.push({ status: 'ON_HOLD', changedBy: req.user._id, changedAt: new Date(), reason });
  audit.activityTimeline.push({
    action: 'AUDIT_ON_HOLD',
    performedBy: req.user._id,
    performedByRole: req.user.role,
    timestamp: new Date(),
    details: { reason, previousStatus: oldStatus },
  });

  await audit.save();

  return res.status(200).json({ success: true, message: 'Audit put on hold.', audit });
};

// POST /api/v1/audits/:id/resume  (admin only)
const resumeAudit = async (req, res) => {
  const audit = await Audit.findById(req.params.id);
  if (!audit) {
    return res.status(404).json({ success: false, message: 'Audit not found.' });
  }

  if (audit.status !== 'ON_HOLD') {
    return res.status(400).json({ success: false, message: 'Audit is not on hold.' });
  }

  // Determine the status to revert to based on assignment state
  const activeAssignment = await Assignment.findOne({
    audit: audit._id,
    status: { $in: ['PENDING', 'ACCEPTED'] },
  });

  let resumeStatus = 'PLANNED';
  if (activeAssignment) {
    resumeStatus = activeAssignment.status === 'ACCEPTED' ? 'ACCEPTED' : 'AWAITING_ACKNOWLEDGEMENT';
  }

  audit.status = resumeStatus;
  audit.statusHistory.push({ status: resumeStatus, changedBy: req.user._id, changedAt: new Date(), reason: 'Resumed from hold' });
  audit.activityTimeline.push({
    action: 'AUDIT_RESUMED',
    performedBy: req.user._id,
    performedByRole: req.user.role,
    timestamp: new Date(),
    details: { resumedToStatus: resumeStatus },
  });

  await audit.save();

  return res.status(200).json({ success: true, message: 'Audit resumed.', audit });
};

// GET /api/v1/audits/:id/timeline
const getAuditTimeline = async (req, res) => {
  const audit = await Audit.findById(req.params.id)
    .select('auditNumber activityTimeline statusHistory')
    .populate('activityTimeline.performedBy', 'name role');

  if (!audit) {
    return res.status(404).json({ success: false, message: 'Audit not found.' });
  }

  return res.status(200).json({
    success: true,
    auditNumber: audit.auditNumber,
    timeline: audit.activityTimeline,
    statusHistory: audit.statusHistory,
  });
};

module.exports = {
  getAudits,
  getAuditBatches,
  getAudit,
  saveAuditAssessment,
  downloadAuditOrderPdf,
  createAudit,
  updateAudit,
  cancelAudit,
  holdAudit,
  resumeAudit,
  getAuditTimeline,
};
