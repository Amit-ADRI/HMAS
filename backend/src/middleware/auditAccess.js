const Team = require('../models/Team');
const Assignment = require('../models/Assignment');

// Admins can manage every audit. Team leads can only access audits assigned to
// their active team; this protects checklist, finding, evidence and report data.
const authorizeAuditAccess = async (req, res, next) => {
  if (req.user.role === 'ADMIN') return next();
  const auditId = req.params.auditId || req.params.id;
  if (!auditId) return res.status(400).json({ success: false, message: 'Audit reference is required.' });
  const team = await Team.findOne({ teamLead: req.user._id, isActive: true });
  const assigned = team && await Assignment.exists({
    audit: auditId,
    team: team._id,
    status: { $nin: ['REASSIGNED', 'CANCELLED'] },
  });
  if (!assigned) return res.status(403).json({ success: false, message: 'Not authorized for this audit.' });
  return next();
};

module.exports = { authorizeAuditAccess };
