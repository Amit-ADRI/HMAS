const AuditLog = require('../models/AuditLog');

// GET /api/v1/audit-logs
const getAuditLogs = async (req, res) => {
  const { page = 1, limit = 30, search, action, dateFrom, dateTo } = req.query;

  const filter = {};

  if (search) {
    filter.$or = [
      { action: { $regex: search, $options: 'i' } },
      { entity: { $regex: search, $options: 'i' } },
      { userRole: { $regex: search, $options: 'i' } },
    ];
  }

  if (action && action !== 'all') {
    filter.action = { $regex: action, $options: 'i' };
  }

  if (dateFrom || dateTo) {
    filter.timestamp = {};
    if (dateFrom) filter.timestamp.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filter.timestamp.$lte = end;
    }
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await AuditLog.countDocuments(filter);
  const pages = Math.ceil(total / Number(limit));

  const logs = await AuditLog.find(filter)
    .populate('userId', 'name email')
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(Number(limit));

  return res.status(200).json({ success: true, logs, total, pages, page: Number(page) });
};

module.exports = { getAuditLogs };
