const Assignment = require('../models/Assignment');
const Audit = require('../models/Audit');
const Hospital = require('../models/Hospital');
const Team = require('../models/Team');
const AuditSchedule = require('../models/AuditSchedule');
const User = require('../models/User');
const { generateAssignmentId } = require('../utils/generateId');
const { notifyNewAssignment, notifyBatchAssignment, notifyReassignmentRequested, notifyReassignmentApproved } = require('../utils/notificationService');
const { logAction } = require('../utils/auditLogger');

const TERMINAL_AUDIT_STATUSES = ['APPROVED', 'CLOSED', 'CANCELLED'];
const ASSIGNABLE_AVAILABILITY = ['Available', 'Partially Available'];
const activeAssignmentCount = async (teamId) => {
  const activeAudits = await Audit.find({ status: { $nin: TERMINAL_AUDIT_STATUSES } }).distinct('_id');
  return Assignment.countDocuments({
    team: teamId,
    audit: { $in: activeAudits },
    status: { $in: ['PENDING', 'ACCEPTED', 'REASSIGNMENT_REQUESTED'] },
  });
};

// POST /api/v1/assignments  (admin only)
const createAssignment = async (req, res) => {
  const { auditId, teamId, expectedAuditDate, priority, instructions } = req.body;

  if (!auditId || !teamId) {
    return res.status(400).json({ success: false, message: 'auditId and teamId are required.' });
  }

  const [audit, team] = await Promise.all([
    Audit.findById(auditId).populate('hospital'),
    Team.findById(teamId).populate('teamLead', 'name email'),
  ]);

  if (!audit) return res.status(404).json({ success: false, message: 'Audit not found.' });
  if (!team) return res.status(404).json({ success: false, message: 'Team not found.' });
  if (!team.isActive || !ASSIGNABLE_AVAILABILITY.includes(team.availability)) return res.status(400).json({ success: false, message: `Team is currently ${team.availability || 'unavailable'} and cannot receive new assignments.` });

  // Check audit can be assigned
  const ASSIGNABLE_STATUSES = ['PLANNED', 'UNASSIGNED'];
  if (!ASSIGNABLE_STATUSES.includes(audit.status)) {
    return res.status(400).json({
      success: false,
      message: `Audit is in '${audit.status}' status and cannot be assigned.`,
    });
  }

  const assignmentId = await generateAssignmentId();
  const acknowledgementDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const assignment = await Assignment.create({
    assignmentId,
    auditBatchId: audit.auditBatchId,
    audit: auditId,
    hospital: audit.hospital._id,
    team: teamId,
    assignedBy: req.user._id,
    assignedAt: new Date(),
    expectedAuditDate,
    acknowledgementDeadline,
    priority: priority || audit.priority,
    instructions,
    status: 'PENDING',
  });

  // Update audit status
  audit.status = 'AWAITING_ACKNOWLEDGEMENT';
  audit.statusHistory.push({
    status: 'AWAITING_ACKNOWLEDGEMENT',
    changedBy: req.user._id,
    changedAt: new Date(),
  });
  audit.activityTimeline.push({
    action: 'AUDIT_ASSIGNED',
    performedBy: req.user._id,
    performedByRole: req.user.role,
    timestamp: new Date(),
    details: {
      assignmentId,
      teamId: team.teamId,
      teamName: team.teamName,
    },
  });
  await audit.save();

  // Notify team lead
  if (team.teamLead) {
    await notifyNewAssignment(
      team.teamLead._id,
      audit.auditNumber,
      audit.hospital.facilityName,
      assignment._id
    );
  }

  await logAction({
    userId: req.user._id,
    userRole: req.user.role,
    action: 'ASSIGNMENT_CREATED',
    entity: 'Assignment',
    entityId: assignment._id,
    newValue: { assignmentId, teamId: team.teamId, auditNumber: audit.auditNumber },
    req,
  });

  await assignment.populate([
    { path: 'team', select: 'teamId teamName' },
    { path: 'audit', select: 'auditNumber status' },
    { path: 'hospital', select: 'facilityName district' },
  ]);

  return res.status(201).json({ success: true, message: 'Assignment created.', assignment });
};

// POST /api/v1/assignments/batch  (admin only)
// Validates the entire set before writing so all requested assignments are created together.
const createBatchAssignments = async (req, res) => {
  const { auditIds, teamId, expectedAuditDate, priority, instructions } = req.body;
  const uniqueAuditIds = Array.isArray(auditIds) ? [...new Set(auditIds.filter(Boolean))] : [];
  if (!uniqueAuditIds.length || !teamId) return res.status(400).json({ success: false, message: 'auditIds and teamId are required.' });

  const [audits, team] = await Promise.all([
    Audit.find({ _id: { $in: uniqueAuditIds } }).populate('hospital'),
    Team.findById(teamId).populate('teamLead', 'name email'),
  ]);
  if (!team || !team.isActive || !ASSIGNABLE_AVAILABILITY.includes(team.availability)) return res.status(400).json({ success: false, message: `Select a team that is active and Available or Partially Available.` });
  if (audits.length !== uniqueAuditIds.length) return res.status(404).json({ success: false, message: 'One or more audits were not found.' });

  const notAssignable = audits.find((audit) => !['PLANNED', 'UNASSIGNED'].includes(audit.status));
  if (notAssignable) return res.status(400).json({ success: false, message: `Audit ${notAssignable.auditNumber} is already ${notAssignable.status} and cannot be assigned.` });
  const createdAssignments = [];
  try {
    for (const audit of audits) {
      const assignmentId = await generateAssignmentId();
      const assignment = await Assignment.create({
        assignmentId,
        auditBatchId: audit.auditBatchId,
        audit: audit._id,
        hospital: audit.hospital._id,
        team: team._id,
        assignedBy: req.user._id,
        assignedAt: new Date(),
        expectedAuditDate,
        acknowledgementDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        priority: priority || audit.priority,
        instructions,
        status: 'PENDING',
      });
      createdAssignments.push(assignment);
    }
  } catch (error) {
    if (createdAssignments.length) await Assignment.deleteMany({ _id: { $in: createdAssignments.map((item) => item._id) } });
    throw error;
  }

  for (const audit of audits) {
    audit.status = 'AWAITING_ACKNOWLEDGEMENT';
    audit.statusHistory.push({ status: 'AWAITING_ACKNOWLEDGEMENT', changedBy: req.user._id, changedAt: new Date() });
    audit.activityTimeline.push({ action: 'AUDIT_ASSIGNED', performedBy: req.user._id, performedByRole: req.user.role, timestamp: new Date(), details: { batchSize: audits.length, teamId: team.teamId, teamName: team.teamName } });
    await audit.save();
  }
  if (team.teamLead) {
    const batchLabel = audits[0].auditBatchId || `AUDITS-${audits.length}`;
    await notifyBatchAssignment(team.teamLead._id, batchLabel, createdAssignments.length, createdAssignments[0]._id);
  }
  await logAction({ userId: req.user._id, userRole: req.user.role, action: 'AUDIT_BATCH_ASSIGNED', entity: 'Assignment', entityId: createdAssignments[0]._id, newValue: { auditIds: uniqueAuditIds, teamId: team.teamId, hospitalCount: audits.length }, req });
  return res.status(201).json({ success: true, message: `${createdAssignments.length} hospital audits assigned to ${team.teamName}.`, assignments: createdAssignments });
};

// GET /api/v1/assignments/:id
const getAssignment = async (req, res) => {
  const assignment = await Assignment.findById(req.params.id)
    .populate('audit', 'auditNumber status priority auditType targetDate reason instructions')
    .populate('hospital', 'facilityId facilityName district state hospitalType totalBedStrength nodalOfficerName nodalOfficerNumber address')
    .populate('team', 'teamId teamName')
    .populate('assignedBy', 'name email')
    .populate('acknowledgedBy', 'name email');

  if (!assignment) {
    return res.status(404).json({ success: false, message: 'Assignment not found.' });
  }

  // Team leads can only see their own team's assignments
  if (req.user.role === 'TEAM_LEAD') {
    const team = await Team.findOne({ teamLead: req.user._id, isActive: true });
    if (!team || assignment.team._id.toString() !== team._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this assignment.' });
    }
  }

  const schedule = await AuditSchedule.findOne({ audit: assignment.audit._id || assignment.audit, assignment: assignment._id, status: 'SCHEDULED' }).sort({ createdAt: -1 });
  return res.status(200).json({ success: true, assignment, schedule: schedule || null });
};

// GET /api/v1/assignments
const getAssignments = async (req, res) => {
  const { status, team, audit, fromDate, toDate, page = 1, limit = 20 } = req.query;

  const filter = {};
  if (status) {
    const statuses = status.split(',').map((item) => item.trim()).filter(Boolean);
    filter.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
  }
  if (team) filter.team = team;
  if (audit) filter.audit = audit;
  if (fromDate || toDate) {
    filter.assignedAt = {};
    if (fromDate) filter.assignedAt.$gte = new Date(fromDate);
    if (toDate) filter.assignedAt.$lte = new Date(toDate + 'T23:59:59.999Z');
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [assignments, total] = await Promise.all([
    Assignment.find(filter)
      .populate('audit', 'auditNumber status priority auditType')
      .populate('hospital', 'facilityName district state')
      .populate('team', 'teamId teamName')
      .populate('assignedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Assignment.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    assignments,
  });
};

// GET /api/v1/assignments/my-assignments (team lead)
const getMyAssignments = async (req, res) => {
  const team = await Team.findOne({ teamLead: req.user._id, isActive: true });

  if (!team) {
    return res.status(200).json({
      success: true,
      message: 'No active team found for this user.',
      assignments: [],
    });
  }

  const { status, fromDate, toDate, page = 1, limit = 20 } = req.query;
  // Reassigned and cancelled records are historical and must not remain in a
  // team's active work queue.
  const filter = { team: team._id, status: { $nin: ['REASSIGNED', 'CANCELLED'] } };
  if (status) {
    const statuses = status.split(',').map((item) => item.trim()).filter(Boolean);
    filter.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
  }
  if (fromDate || toDate) {
    filter.assignedAt = {};
    if (fromDate) filter.assignedAt.$gte = new Date(fromDate);
    if (toDate) filter.assignedAt.$lte = new Date(toDate + 'T23:59:59.999Z');
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [assignments, total] = await Promise.all([
    Assignment.find(filter)
      .populate('audit', 'auditNumber auditBatchId status targetDate isSuspicious suspicionRemarks updatedAt')
      .populate('hospital', 'facilityName district state nodalOfficerName nodalOfficerNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Assignment.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    team: { teamId: team.teamId, teamName: team.teamName },
    assignments,
  });
};

// POST /api/v1/assignments/:id/acknowledge (team lead)
const acknowledgeAssignment = async (req, res) => {
  const assignment = await Assignment.findById(req.params.id)
    .populate('team')
    .populate('audit');

  if (!assignment) {
    return res.status(404).json({ success: false, message: 'Assignment not found.' });
  }

  // Verify the user is the team lead of this assignment's team
  if (assignment.team.teamLead.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized to acknowledge this assignment.' });
  }

  if (assignment.status !== 'PENDING') {
    return res.status(400).json({ success: false, message: `Assignment is already in '${assignment.status}' status.` });
  }

  assignment.status = 'ACCEPTED';
  assignment.acknowledgedAt = new Date();
  assignment.acknowledgedBy = req.user._id;
  assignment.acknowledgementHistory.push({
    action: 'ACCEPTED',
    performedBy: req.user._id,
    timestamp: assignment.acknowledgedAt,
  });
  await assignment.save();

  // Update audit status
  await Audit.findByIdAndUpdate(assignment.audit._id, {
    status: 'ACCEPTED',
    $push: {
      statusHistory: { status: 'ACCEPTED', changedBy: req.user._id, changedAt: new Date() },
      activityTimeline: {
        action: 'ASSIGNMENT_ACKNOWLEDGED',
        performedBy: req.user._id,
        performedByRole: req.user.role,
        timestamp: new Date(),
        details: { assignmentId: assignment.assignmentId },
      },
    },
  });

  return res.status(200).json({ success: true, message: 'Assignment acknowledged.', assignment });
};

// POST /api/v1/assignments/:id/request-reassignment (team lead)
const requestReassignment = async (req, res) => {
  const { reason } = req.body;

  if (!reason || reason.trim().length < 3) {
    return res.status(400).json({ success: false, message: 'Please provide a reason for reassignment.' });
  }

  const assignment = await Assignment.findById(req.params.id).populate('team').populate('audit');

  if (!assignment) {
    return res.status(404).json({ success: false, message: 'Assignment not found.' });
  }

  if (assignment.team.teamLead.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized.' });
  }

  if (!['PENDING', 'ACCEPTED'].includes(assignment.status)) {
    return res.status(400).json({ success: false, message: `Cannot request reassignment in '${assignment.status}' status.` });
  }

  assignment.status = 'REASSIGNMENT_REQUESTED';
  assignment.acknowledgementHistory.push({
    action: 'REASSIGNMENT_REQUESTED',
    performedBy: req.user._id,
    timestamp: new Date(),
    reassignmentReason: reason,
  });
  await assignment.save();

  // Update audit timeline
  await Audit.findByIdAndUpdate(assignment.audit._id, {
    $push: {
      activityTimeline: {
        action: 'REASSIGNMENT_REQUESTED',
        performedBy: req.user._id,
        performedByRole: req.user.role,
        timestamp: new Date(),
        details: { reason, fromTeam: assignment.team.teamName },
      },
    },
  });

  // Notify all admins
  const admins = await User.find({ role: 'ADMIN', isActive: true }).select('_id');
  await Promise.all(
    admins.map((admin) =>
      notifyReassignmentRequested(
        admin._id,
        assignment.audit.auditNumber,
        assignment.team.teamName,
        reason,
        assignment._id
      )
    )
  );

  return res.status(200).json({ success: true, message: 'Reassignment requested.', assignment });
};

// POST /api/v1/assignments/:id/approve-reassignment (admin)
const approveReassignment = async (req, res) => {
  const { newTeamId } = req.body;

  if (!newTeamId) {
    return res.status(400).json({ success: false, message: 'newTeamId is required.' });
  }

  const [assignment, newTeam] = await Promise.all([
    Assignment.findById(req.params.id).populate('team').populate('audit'),
    Team.findById(newTeamId).populate('teamLead', 'name email'),
  ]);

  if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found.' });
  if (!newTeam) return res.status(404).json({ success: false, message: 'New team not found.' });

  if (assignment.status !== 'REASSIGNMENT_REQUESTED') {
    return res.status(400).json({ success: false, message: 'Assignment does not have a pending reassignment request.' });
  }

  const oldTeam = assignment.team;

  // Mark old assignment as reassigned
  assignment.status = 'REASSIGNED';
  assignment.reassignmentHistory.push({
    fromTeam: oldTeam._id,
    toTeam: newTeamId,
    requestedBy: req.user._id,
    requestedAt: new Date(),
    approvedBy: req.user._id,
    approvedAt: new Date(),
  });
  await assignment.save();
  await AuditSchedule.updateMany({ assignment: assignment._id, status: 'SCHEDULED' }, { status: 'CANCELLED' });

  // Create new assignment for new team
  const { generateAssignmentId: genId } = require('../utils/generateId');
  const newAssignmentId = await genId();
  const newAssignment = await Assignment.create({
    assignmentId: newAssignmentId,
    audit: assignment.audit._id,
    hospital: assignment.hospital,
    team: newTeamId,
    assignedBy: req.user._id,
    assignedAt: new Date(),
    expectedAuditDate: assignment.expectedAuditDate,
    acknowledgementDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
    priority: assignment.priority,
    instructions: assignment.instructions,
    status: 'PENDING',
  });

  // Update audit
  await Audit.findByIdAndUpdate(assignment.audit._id, {
    status: 'AWAITING_ACKNOWLEDGEMENT',
    $push: {
      statusHistory: { status: 'AWAITING_ACKNOWLEDGEMENT', changedBy: req.user._id, changedAt: new Date() },
      activityTimeline: {
        action: 'REASSIGNMENT_APPROVED',
        performedBy: req.user._id,
        performedByRole: req.user.role,
        timestamp: new Date(),
        details: {
          fromTeam: oldTeam.teamName,
          toTeam: newTeam.teamName,
          newAssignmentId,
        },
      },
    },
  });

  // Notify old team lead - request was approved
  if (oldTeam.teamLead) {
    await notifyReassignmentApproved(
      oldTeam.teamLead._id || oldTeam.teamLead,
      assignment.audit.auditNumber,
      assignment._id
    );
  }

  // Notify new team lead
  if (newTeam.teamLead) {
    const audit = assignment.audit;
    const hospital = await Hospital.findById(assignment.hospital);
    await notifyNewAssignment(
      newTeam.teamLead._id,
      audit.auditNumber,
      hospital?.facilityName || 'Hospital',
      newAssignment._id
    );
  }

  return res.status(200).json({
    success: true,
    message: 'Reassignment approved. New assignment created.',
    newAssignment,
  });
};

// POST /api/v1/assignments/:id/reject-reassignment (admin)
const rejectReassignment = async (req, res) => {
  const { remarks } = req.body;
  const assignment = await Assignment.findById(req.params.id).populate('audit').populate('team');
  if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found.' });
  if (assignment.status !== 'REASSIGNMENT_REQUESTED') {
    return res.status(400).json({ success: false, message: 'Assignment does not have a pending reassignment request.' });
  }

  const wasAccepted = assignment.acknowledgementHistory.some((entry) => entry.action === 'ACCEPTED');
  const restoredStatus = wasAccepted ? 'ACCEPTED' : 'PENDING';
  assignment.status = restoredStatus;
  assignment.acknowledgementHistory.push({ action: 'REASSIGNMENT_REJECTED', performedBy: req.user._id, timestamp: new Date(), reason: remarks });
  await assignment.save();

  await Audit.findByIdAndUpdate(assignment.audit._id, {
    status: wasAccepted ? 'ACCEPTED' : 'AWAITING_ACKNOWLEDGEMENT',
    $push: {
      statusHistory: { status: wasAccepted ? 'ACCEPTED' : 'AWAITING_ACKNOWLEDGEMENT', changedBy: req.user._id, changedAt: new Date(), reason: remarks || 'Reassignment request rejected' },
      activityTimeline: { action: 'REASSIGNMENT_REJECTED', performedBy: req.user._id, performedByRole: req.user.role, timestamp: new Date(), details: { remarks } },
    },
  });
  return res.status(200).json({ success: true, message: 'Reassignment request rejected; assignment restored.', assignment });
};

// POST /api/v1/assignments/:id/reassign (admin)
// Allows the administrator to act before a team lead formally requests reassignment.
const manuallyReassign = async (req, res) => {
  const { newTeamId, reason } = req.body;
  if (!newTeamId || !reason || reason.trim().length < 10) {
    return res.status(400).json({ success: false, message: 'New team and a reason of at least 10 characters are required.' });
  }
  const [assignment, newTeam] = await Promise.all([
    Assignment.findById(req.params.id).populate('audit').populate('team'),
    Team.findById(newTeamId).populate('teamLead', 'name email'),
  ]);
  if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found.' });
  if (!newTeam || !newTeam.isActive || !ASSIGNABLE_AVAILABILITY.includes(newTeam.availability)) return res.status(400).json({ success: false, message: 'Select a team that is active and Available or Partially Available.' });
  if (assignment.team._id.toString() === newTeam._id.toString()) return res.status(400).json({ success: false, message: 'Select a different team.' });
  if (!['PENDING', 'ACCEPTED'].includes(assignment.status)) return res.status(400).json({ success: false, message: `Cannot directly reassign an assignment in '${assignment.status}' status.` });
  const oldTeam = assignment.team;
  assignment.status = 'REASSIGNED';
  assignment.reassignmentHistory.push({ fromTeam: oldTeam._id, toTeam: newTeam._id, requestedBy: req.user._id, requestedAt: new Date(), approvedBy: req.user._id, approvedAt: new Date(), reason });
  await assignment.save();
  await AuditSchedule.updateMany({ assignment: assignment._id, status: 'SCHEDULED' }, { status: 'CANCELLED' });
  const assignmentId = await generateAssignmentId();
  const newAssignment = await Assignment.create({ assignmentId, audit: assignment.audit._id, hospital: assignment.hospital, team: newTeam._id, assignedBy: req.user._id, assignedAt: new Date(), expectedAuditDate: assignment.expectedAuditDate, acknowledgementDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000), priority: assignment.priority, instructions: assignment.instructions, status: 'PENDING' });
  await Audit.findByIdAndUpdate(assignment.audit._id, { status: 'AWAITING_ACKNOWLEDGEMENT', $push: { statusHistory: { status: 'AWAITING_ACKNOWLEDGEMENT', changedBy: req.user._id, changedAt: new Date(), reason }, activityTimeline: { action: 'ADMIN_REASSIGNED', performedBy: req.user._id, performedByRole: req.user.role, timestamp: new Date(), details: { fromTeam: oldTeam.teamName, toTeam: newTeam.teamName, reason, assignmentId } } } });
  const hospital = await Hospital.findById(assignment.hospital).select('facilityName');
  if (newTeam.teamLead) await notifyNewAssignment(newTeam.teamLead._id, assignment.audit.auditNumber, hospital?.facilityName || 'Hospital', newAssignment._id);
  return res.status(201).json({ success: true, message: 'Audit reassigned to the new team.', assignment: newAssignment });
};

// POST /api/v1/assignments/:id/schedule (team lead)
const scheduleAudit = async (req, res) => {
  const { scheduledDate, startTime, expectedDuration, remarks } = req.body;

  if (!scheduledDate) {
    return res.status(400).json({ success: false, message: 'scheduledDate is required.' });
  }

  const assignment = await Assignment.findById(req.params.id).populate('team').populate('audit');

  if (!assignment) {
    return res.status(404).json({ success: false, message: 'Assignment not found.' });
  }

  if (assignment.team.teamLead.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized.' });
  }

  if (assignment.status !== 'ACCEPTED') {
    return res.status(400).json({ success: false, message: 'Assignment must be ACCEPTED before scheduling.' });
  }

  // Deactivate old schedules
  await AuditSchedule.updateMany(
    { audit: assignment.audit._id, status: 'SCHEDULED' },
    { status: 'RESCHEDULED', $push: { scheduleHistory: { reason: 'Rescheduled', changedBy: req.user._id, changedAt: new Date() } } }
  );

  const schedule = await AuditSchedule.create({
    audit: assignment.audit._id,
    assignment: assignment._id,
    scheduledDate: new Date(scheduledDate),
    startTime,
    expectedDuration,
    remarks,
    status: 'SCHEDULED',
    createdBy: req.user._id,
  });

  // Update audit status
  await Audit.findByIdAndUpdate(assignment.audit._id, {
    status: 'SCHEDULED',
    $push: {
      statusHistory: { status: 'SCHEDULED', changedBy: req.user._id, changedAt: new Date() },
      activityTimeline: {
        action: 'AUDIT_SCHEDULED',
        performedBy: req.user._id,
        performedByRole: req.user.role,
        timestamp: new Date(),
        details: { scheduledDate, startTime, expectedDuration },
      },
    },
  });

  return res.status(201).json({ success: true, message: 'Audit scheduled.', schedule });
};

// POST /api/v1/assignments/:id/start-audit (team lead)
const startAudit = async (req, res) => {
  const { gpsCoordinates } = req.body;

  const assignment = await Assignment.findById(req.params.id).populate('team').populate('audit');

  if (!assignment) {
    return res.status(404).json({ success: false, message: 'Assignment not found.' });
  }

  if (assignment.team.teamLead.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized.' });
  }

  if (!['ACCEPTED', 'SCHEDULED'].includes(assignment.audit.status)) {
    return res.status(400).json({ success: false, message: 'Audit must be accepted before starting.' });
  }

  // Update audit
  await Audit.findByIdAndUpdate(assignment.audit._id, {
    status: 'IN_PROGRESS',
    $push: {
      statusHistory: { status: 'IN_PROGRESS', changedBy: req.user._id, changedAt: new Date() },
      activityTimeline: {
        action: 'AUDIT_STARTED',
        performedBy: req.user._id,
        performedByRole: req.user.role,
        timestamp: new Date(),
        details: {
          startedAt: new Date().toISOString(),
          ip: req.ip,
          device: req.headers['user-agent'],
          gpsCoordinates,
        },
      },
    },
  });

  return res.status(200).json({
    success: true,
    message: 'Audit started. Status is now IN_PROGRESS.',
    startedAt: new Date().toISOString(),
  });
};

// GET /api/v1/assignments/reassignment-requests (admin)
const getReassignmentRequests = async (req, res) => {
  const { fromDate, toDate, page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const reqFilter = { status: 'REASSIGNMENT_REQUESTED' };
  if (fromDate || toDate) {
    reqFilter.updatedAt = {};
    if (fromDate) reqFilter.updatedAt.$gte = new Date(fromDate);
    if (toDate) reqFilter.updatedAt.$lte = new Date(toDate + 'T23:59:59.999Z');
  }

  const [assignments, total] = await Promise.all([
    Assignment.find(reqFilter)
      .populate('audit', 'auditNumber status priority')
      .populate('hospital', 'facilityName district')
      .populate('team', 'teamId teamName')
      .populate('assignedBy', 'name')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Assignment.countDocuments(reqFilter),
  ]);

  return res.status(200).json({
    success: true,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    assignments,
  });
};

module.exports = {
  createAssignment,
  createBatchAssignments,
  getAssignment,
  getAssignments,
  getMyAssignments,
  acknowledgeAssignment,
  requestReassignment,
  approveReassignment,
  rejectReassignment,
  manuallyReassign,
  scheduleAudit,
  startAudit,
  getReassignmentRequests,
};
