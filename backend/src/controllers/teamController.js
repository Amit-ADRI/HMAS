const Team = require('../models/Team');
const Assignment = require('../models/Assignment');
const Audit = require('../models/Audit');
const { generateTeamId } = require('../utils/generateId');
const { logAction } = require('../utils/auditLogger');

const activeAuditIds = () => Audit.find({ status: { $nin: ['APPROVED', 'CLOSED', 'CANCELLED'] } }).distinct('_id');

// GET /api/v1/teams
const getTeams = async (req, res) => {
  const { availability, isActive, search, page = 1, limit = 20 } = req.query;

  const filter = {};
  if (availability) filter.availability = availability;
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (search) {
    filter.$or = [
      { teamName: { $regex: search, $options: 'i' } },
      { teamId: { $regex: search, $options: 'i' } },
      { teamLeadEmail: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [teams, total] = await Promise.all([
    Team.find(filter)
      .populate('teamLead', 'name email mobile')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Team.countDocuments(filter),
  ]);

  // Attach active assignment count to each team
  const teamsWithLoad = await Promise.all(
    teams.map(async (team) => {
      const activeCount = await Assignment.countDocuments({
        team: team._id,
        audit: { $in: await activeAuditIds() },
        status: { $in: ['PENDING', 'ACCEPTED', 'REASSIGNMENT_REQUESTED'] },
      });
      const obj = team.toObject();
      obj.activeAssignments = activeCount;
      return obj;
    })
  );

  return res.status(200).json({
    success: true,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    teams: teamsWithLoad,
  });
};

// GET /api/v1/teams/:id
const getTeam = async (req, res) => {
  const team = await Team.findById(req.params.id).populate('teamLead', 'name email mobile userId');

  if (!team) {
    return res.status(404).json({ success: false, message: 'Team not found.' });
  }

  const activeAssignments = await Assignment.find({
    team: team._id,
    audit: { $in: await activeAuditIds() },
    status: { $in: ['PENDING', 'ACCEPTED', 'REASSIGNMENT_REQUESTED'] },
  })
    .populate('audit', 'auditNumber status priority')
    .populate('hospital', 'facilityName district');

  return res.status(200).json({ success: true, team, activeAssignments });
};

// GET /api/v1/teams/:id/assignments
const getTeamAssignments = async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) return res.status(404).json({ success: false, message: 'Team not found.' });
  const assignments = await Assignment.find({ team: team._id })
    .populate('audit', 'auditNumber status targetDate')
    .populate('hospital', 'facilityName district')
    .sort({ createdAt: -1 });
  return res.status(200).json({ success: true, assignments });
};

// Team leads may maintain their own roster; admins retain full team controls.
const getMyTeam = async (req, res) => {
  const team = await Team.findOne({ teamLead: req.user._id, isActive: true }).populate('teamLead', 'name email mobile');
  if (!team) return res.status(404).json({ success: false, message: 'No active team is linked to this Team Lead.' });
  return res.status(200).json({ success: true, team });
};

const updateMyTeamMembers = async (req, res) => {
  const team = await Team.findOne({ teamLead: req.user._id, isActive: true });
  if (!team) return res.status(404).json({ success: false, message: 'No active team is linked to this Team Lead.' });
  if (!Array.isArray(req.body.members)) return res.status(400).json({ success: false, message: 'members must be an array.' });
  const members = req.body.members.map((member) => ({ name: String(member.name || '').trim(), role: String(member.role || 'Auditor').trim(), email: String(member.email || '').trim(), mobile: String(member.mobile || '').trim() })).filter((member) => member.name);
  if (members.some((member) => !member.role)) return res.status(400).json({ success: false, message: 'Every member requires a role.' });
  team.members = members;
  await team.save();
  await logAction({ userId: req.user._id, userRole: req.user.role, action: 'TEAM_MEMBERS_UPDATED', entity: 'Team', entityId: team._id, newValue: { memberCount: members.length }, req });
  return res.status(200).json({ success: true, message: 'Team members updated.', team });
};

// POST /api/v1/teams  (admin only)
const createTeam = async (req, res) => {
  const { teamLead } = req.body;

  if (!teamLead) {
    return res.status(400).json({ success: false, message: 'Team lead is required.' });
  }

  // Check if this user is already a team lead of another active team
  const existingTeam = await Team.findOne({ teamLead, isActive: true });
  if (existingTeam) {
    return res.status(409).json({
      success: false,
      message: 'This user is already leading an active team.',
    });
  }

  const teamId = await generateTeamId();
  const team = await Team.create({ ...req.body, teamId });

  await team.populate('teamLead', 'name email mobile');

  await logAction({
    userId: req.user._id,
    userRole: req.user.role,
    action: 'TEAM_CREATED',
    entity: 'Team',
    entityId: team._id,
    newValue: { teamId: team.teamId, teamName: team.teamName },
    req,
  });

  return res.status(201).json({ success: true, message: 'Team created.', team });
};

// PUT /api/v1/teams/:id  (admin only)
const updateTeam = async (req, res) => {
  const { id } = req.params;

  const team = await Team.findById(id);
  if (!team) {
    return res.status(404).json({ success: false, message: 'Team not found.' });
  }

  const immutableFields = ['teamId', '_id'];
  immutableFields.forEach((f) => delete req.body[f]);

  if (req.body.teamLead && req.body.teamLead.toString() !== team.teamLead.toString()) {
    const User = require('../models/User');
    const lead = await User.findOne({ _id: req.body.teamLead, role: 'TEAM_LEAD', isActive: true });
    if (!lead) return res.status(400).json({ success: false, message: 'Select an active Team Lead user.' });
    const existingTeam = await Team.findOne({ teamLead: req.body.teamLead, isActive: true, _id: { $ne: team._id } });
    if (existingTeam) return res.status(409).json({ success: false, message: 'This user already leads another active team.' });
  }

  Object.assign(team, req.body);
  await team.save();
  await team.populate('teamLead', 'name email mobile');

  await logAction({
    userId: req.user._id,
    userRole: req.user.role,
    action: 'TEAM_UPDATED',
    entity: 'Team',
    entityId: team._id,
    newValue: { teamName: team.teamName },
    req,
  });

  return res.status(200).json({ success: true, message: 'Team updated.', team });
};

// DELETE /api/v1/teams/:id  (admin only)
const deleteTeam = async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) return res.status(404).json({ success: false, message: 'Team not found.' });
  const assignments = await Assignment.find({ team: team._id, status: { $nin: ['REASSIGNED', 'CANCELLED'] } }).populate('audit', 'auditNumber status');
  const activeAssignment = assignments.find((assignment) => assignment.audit && !['COMPLETED', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'CLOSED', 'CANCELLED'].includes(assignment.audit.status));
  if (activeAssignment) {
    return res.status(400).json({ success: false, message: `This team still has active audit ${activeAssignment.audit.auditNumber}. Reassign or complete it before deletion.` });
  }
  await Team.deleteOne({ _id: team._id });
  await logAction({ userId: req.user._id, userRole: req.user.role, action: 'TEAM_DELETED', entity: 'Team', entityId: team._id, oldValue: { teamId: team.teamId, teamName: team.teamName }, req });
  return res.status(200).json({ success: true, message: 'Team deleted.' });
};

// PATCH /api/v1/teams/:id/availability
const updateAvailability = async (req, res) => {
  const { id } = req.params;
  const { availability } = req.body;

  const VALID_STATUSES = ['Available', 'Partially Available', 'Busy', 'On Audit', 'On Leave', 'Unavailable', 'Inactive'];

  if (!VALID_STATUSES.includes(availability)) {
    return res.status(400).json({ success: false, message: `Invalid availability. Options: ${VALID_STATUSES.join(', ')}` });
  }

  const team = await Team.findById(id);
  if (!team) {
    return res.status(404).json({ success: false, message: 'Team not found.' });
  }

  // Only admin or the team lead can update availability
  if (req.user.role !== 'ADMIN' && team.teamLead.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized to update this team.' });
  }

  team.availability = availability;
  await team.save();

  return res.status(200).json({ success: true, message: 'Availability updated.', availability: team.availability });
};

// GET /api/v1/teams/:id/workload
const getTeamWorkload = async (req, res) => {
  const { id } = req.params;

  const team = await Team.findById(id);
  if (!team) {
    return res.status(404).json({ success: false, message: 'Team not found.' });
  }

  const [active, pending, reassignmentRequested] = await Promise.all([
    Assignment.countDocuments({ team: id, status: 'ACCEPTED' }),
    Assignment.countDocuments({ team: id, status: 'PENDING' }),
    Assignment.countDocuments({ team: id, status: 'REASSIGNMENT_REQUESTED' }),
  ]);

  const Audit = require('../models/Audit');
  const pendingReports = await Audit.countDocuments({
    status: { $in: ['COMPLETED', 'RETURNED'] },
    // Need to join with Assignment to filter by team - use aggregation
  });

  // Better aggregation for pending reports
  const pendingReportsAgg = await Assignment.aggregate([
    { $match: { team: team._id, status: 'ACCEPTED' } },
    {
      $lookup: {
        from: 'audits',
        localField: 'audit',
        foreignField: '_id',
        as: 'auditDoc',
      },
    },
    { $unwind: '$auditDoc' },
    { $match: { 'auditDoc.status': { $in: ['COMPLETED', 'RETURNED'] } } },
    { $count: 'count' },
  ]);

  return res.status(200).json({
    success: true,
    workload: {
      teamId: team.teamId,
      teamName: team.teamName,
      availability: team.availability,
      active,
      pending,
      reassignmentRequested,
      pendingReports: pendingReportsAgg[0]?.count || 0,
    },
  });
};

module.exports = {
  getTeams,
  getTeam,
  getTeamAssignments,
  getMyTeam,
  updateMyTeamMembers,
  createTeam,
  updateTeam,
  deleteTeam,
  updateAvailability,
  getTeamWorkload,
};
