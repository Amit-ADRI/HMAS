const AuditLog = require('../models/AuditLog');

const logAction = async ({ userId, userRole, action, entity, entityId, oldValue, newValue, reason, req }) => {
  try {
    await AuditLog.create({
      userId,
      userRole,
      action,
      entity,
      entityId,
      oldValue: oldValue ? JSON.stringify(oldValue) : undefined,
      newValue: newValue ? JSON.stringify(newValue) : undefined,
      reason,
      ipAddress: req?.ip,
      device: req?.headers?.['user-agent'],
      timestamp: new Date(),
    });
  } catch (err) {
    // Log errors should not crash the main flow
    console.error('AuditLogger error:', err.message);
  }
};

module.exports = { logAction };
