const Audit = require('../models/Audit');
const Assignment = require('../models/Assignment');
const Hospital = require('../models/Hospital');
const Team = require('../models/Team');
const Notification = require('../models/Notification');
const AuditSchedule = require('../models/AuditSchedule');

// GET /api/v1/dashboard/admin  (admin only)
const getAdminDashboard = async (req, res) => {
  const now = new Date();
  const { date, month, year } = req.query;
  const auditDateFilter = {};
  let selectedPeriod = 'All time';
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const start = new Date(`${date}T00:00:00.000`);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    auditDateFilter.createdAt = { $gte: start, $lt: end };
    selectedPeriod = date;
  } else if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [selectedYear, selectedMonth] = month.split('-').map(Number);
    auditDateFilter.createdAt = { $gte: new Date(selectedYear, selectedMonth - 1, 1), $lt: new Date(selectedYear, selectedMonth, 1) };
    selectedPeriod = month;
  } else if (year && /^\d{4}$/.test(year)) {
    auditDateFilter.createdAt = { $gte: new Date(Number(year), 0, 1), $lt: new Date(Number(year) + 1, 0, 1) };
    selectedPeriod = year;
  }

  const [
    totalHospitals,
    auditStatusCounts,
    overdueAudits,
    reassignmentRequests,
    monthlyTrend,
    districtWise,
    allTeams,
  ] = await Promise.all([
    Hospital.countDocuments({}),

    // Audit status distribution
    Audit.aggregate([
      ...(Object.keys(auditDateFilter).length ? [{ $match: auditDateFilter }] : []),
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    // Overdue: targetDate past and not in terminal status
    Audit.countDocuments({
      ...auditDateFilter,
      targetDate: { $lt: now },
      status: { $nin: ['COMPLETED', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'CLOSED', 'CANCELLED'] },
    }),

    // Pending reassignment requests (from Assignment collection)
    Assignment.countDocuments({ status: 'REASSIGNMENT_REQUESTED' }),

    // Monthly trend: audits created in last 12 months, grouped by month
    Audit.aggregate([
      {
        $match: Object.keys(auditDateFilter).length ? auditDateFilter : { createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 11)) } },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),

    // District-wise audit count (top 10)
    Audit.aggregate([
      ...(Object.keys(auditDateFilter).length ? [{ $match: auditDateFilter }] : []),
      {
        $lookup: {
          from: 'hospitals',
          localField: 'hospital',
          foreignField: '_id',
          as: 'hospitalData',
        },
      },
      { $unwind: '$hospitalData' },
      { $group: { _id: '$hospitalData.district', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),

    // All active teams with their lead info
    Team.find({ isActive: true }).populate('teamLead', 'name email'),
  ]);

  // Build status map from aggregation
  const statusMap = {};
  auditStatusCounts.forEach((s) => {
    statusMap[s._id] = s.count;
  });

  // Compute per-status counts used on the dashboard tiles
  const totalAudits = Object.values(statusMap).reduce((a, b) => a + b, 0);

  // Build team workload
  const teamWorkload = await Promise.all(
    allTeams.map(async (team) => {
      const [activeCount, upcomingCount, totalAssignments, closedCount] = await Promise.all([
        // Active = ACCEPTED + SCHEDULED + IN_PROGRESS assignments for this team
        Assignment.countDocuments({
          team: team._id,
          status: { $in: ['ACCEPTED', 'SCHEDULED', 'IN_PROGRESS'] },
        }),
        // Upcoming = SCHEDULED assignments where scheduledDate is in the future
        AuditSchedule.countDocuments({
          status: 'SCHEDULED',
          scheduledDate: { $gte: new Date() },
          assignment: {
            $in: await Assignment.find({ team: team._id, status: 'ACCEPTED' }).distinct('_id'),
          },
        }),
        // Total non-cancelled, non-reassigned
        Assignment.countDocuments({
          team: team._id,
          status: { $nin: ['CANCELLED', 'REASSIGNED'] },
        }),
        // Closed = audits whose current assignment belongs to this team and audit status is CLOSED or APPROVED
        Assignment.aggregate([
          { $match: { team: team._id, status: { $nin: ['CANCELLED', 'REASSIGNED'] } } },
          {
            $lookup: {
              from: 'audits',
              localField: 'audit',
              foreignField: '_id',
              as: 'auditDoc',
            },
          },
          { $unwind: '$auditDoc' },
          { $match: { 'auditDoc.status': { $in: ['CLOSED', 'APPROVED'] } } },
          { $count: 'count' },
        ]),
      ]);

      const closed = closedCount[0]?.count || 0;
      const completionRate = totalAssignments > 0 ? Math.round((closed / totalAssignments) * 100) : 0;

      return {
        _id: team._id,
        teamName: team.teamName,
        teamLeadName: team.teamLead?.name || team.teamLeadEmail || '—',
        activeCount,
        upcomingCount,
        completionRate,
        availability: team.availability || 'Unknown',
      };
    })
  );

  // Format monthlyTrend for the frontend bar chart: [{month: 'Jan 2026', count: N}]
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formattedMonthlyTrend = monthlyTrend.map((m) => ({
    month: `${MONTH_NAMES[m._id.month - 1]} ${m._id.year}`,
    count: m.count,
  }));

  return res.status(200).json({
    success: true,
    data: {
      stats: {
        totalHospitals,
        totalAudits,
        planned: statusMap['PLANNED'] || 0,
        unassigned: statusMap['UNASSIGNED'] || 0,
        assigned: statusMap['ASSIGNED'] || 0,
        awaitingAck: statusMap['AWAITING_ACKNOWLEDGEMENT'] || 0,
        accepted: statusMap['ACCEPTED'] || 0,
        scheduled: statusMap['SCHEDULED'] || 0,
        inProgress: statusMap['IN_PROGRESS'] || 0,
        completed: statusMap['COMPLETED'] || 0,
        submitted: statusMap['SUBMITTED'] || 0,
        underReview: statusMap['UNDER_REVIEW'] || 0,
        returned: statusMap['RETURNED'] || 0,
        approved: statusMap['APPROVED'] || 0,
        closed: statusMap['CLOSED'] || 0,
        overdue: overdueAudits,
        reassignmentRequests,
        cancelled: statusMap['CANCELLED'] || 0,
      },
      teamWorkload,
      monthlyTrend: formattedMonthlyTrend,
      districtWise: districtWise.map((d) => ({ district: d._id, count: d.count })),
      selectedPeriod,
    },
  });
};

// GET /api/v1/dashboard/team-lead  (team lead only)
const getTeamLeadDashboard = async (req, res) => {
  const team = await Team.findOne({ teamLead: req.user._id, isActive: true });

  if (!team) {
    return res.status(200).json({
      success: true,
      message: 'No active team assigned.',
      data: {
        stats: {
          newAssignments: 0,
          accepted: 0,
          scheduled: 0,
          inProgress: 0,
          completed: 0,
          submitted: 0,
          returned: 0,
          overdue: 0,
        },
        upcomingVisits: [],
      },
    });
  }

  const now = new Date();

  // Get assignment status counts for this team
  const assignmentStatusCounts = await Assignment.aggregate([
    { $match: { team: team._id, status: { $nin: ['REASSIGNED', 'CANCELLED'] } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const statusMap = {};
  assignmentStatusCounts.forEach((s) => {
    statusMap[s._id] = s.count;
  });

  // Get audit statuses for audits assigned to this team
  const teamAuditIds = await Assignment.find({
    team: team._id,
    status: { $nin: ['REASSIGNED', 'CANCELLED'] },
  }).distinct('audit');

  const auditStatusCounts = await Audit.aggregate([
    { $match: { _id: { $in: teamAuditIds } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const auditStatusMap = {};
  auditStatusCounts.forEach((s) => {
    auditStatusMap[s._id] = s.count;
  });

  // Overdue: audits for this team that have passed targetDate and are not closed
  const overdueAudits = await Audit.countDocuments({
    _id: { $in: teamAuditIds },
    targetDate: { $lt: now },
    status: { $nin: ['COMPLETED', 'SUBMITTED', 'APPROVED', 'CLOSED', 'CANCELLED'] },
  });

  // Upcoming visits (next 14 days) — scheduled audits with a schedule record
  const acceptedAuditIds = await Assignment.find({
    team: team._id,
    status: 'ACCEPTED',
  }).distinct('audit');

  const upcomingSchedules = await AuditSchedule.find({
    audit: { $in: acceptedAuditIds },
    scheduledDate: { $gte: now, $lte: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) },
    status: 'SCHEDULED',
  })
    .populate({
      path: 'assignment',
      populate: [
        { path: 'audit', select: 'auditNumber status priority targetDate' },
        { path: 'hospital', select: 'facilityName district state' },
      ],
    })
    .sort({ scheduledDate: 1 })
    .limit(10);

  // Shape upcomingVisits for the frontend
  const upcomingVisits = upcomingSchedules.map((schedule) => {
    const assignmentDoc = schedule.assignment || {};
    const auditDoc = assignmentDoc.audit || {};
    const hospitalDoc = assignmentDoc.hospital || {};
    return {
      auditId: auditDoc._id || auditDoc,
      auditNumber: auditDoc.auditNumber || '',
      hospitalName: hospitalDoc.facilityName || '',
      scheduledDate: schedule.scheduledDate,
      priority: auditDoc.priority || 'Normal',
    };
  });

  return res.status(200).json({
    success: true,
    data: {
      stats: {
        newAssignments: statusMap['PENDING'] || 0,
        accepted: statusMap['ACCEPTED'] || 0,
        scheduled: auditStatusMap['SCHEDULED'] || 0,
        inProgress: auditStatusMap['IN_PROGRESS'] || 0,
        completed: auditStatusMap['COMPLETED'] || 0,
        submitted: auditStatusMap['SUBMITTED'] || 0,
        returned: auditStatusMap['RETURNED'] || 0,
        overdue: overdueAudits,
      },
      team: { teamName: team.teamName, availability: team.availability, memberCount: team.members?.length || 0 },
      upcomingVisits,
    },
  });
};

module.exports = { getAdminDashboard, getTeamLeadDashboard };
