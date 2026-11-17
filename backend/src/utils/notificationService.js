const Notification = require('../models/Notification');

const createNotification = async ({ recipientId, type, title, message, relatedEntity, relatedEntityId }) => {
  return await Notification.create({
    recipient: recipientId,
    type,
    title,
    message,
    relatedEntity,
    relatedEntityId,
  });
};

const notifyNewAssignment = async (teamLeadId, auditNumber, hospitalName, assignmentId) => {
  return createNotification({
    recipientId: teamLeadId,
    type: 'NEW_ASSIGNMENT',
    title: 'New Audit Assignment',
    message: `You have been assigned audit ${auditNumber} for ${hospitalName}. Please acknowledge within 24 hours.`,
    relatedEntity: 'Assignment',
    relatedEntityId: assignmentId,
  });
};

const notifyBatchAssignment = async (teamLeadId, batchId, hospitalCount, assignmentId) => createNotification({
  recipientId: teamLeadId,
  type: 'NEW_ASSIGNMENT',
  title: 'New Multi-Hospital Audit Batch',
  message: `${hospitalCount} hospital audits were assigned in batch ${batchId}. Review and acknowledge each hospital assignment.`,
  relatedEntity: 'Assignment',
  relatedEntityId: assignmentId,
});

const notifyReportSubmitted = async (adminId, auditNumber, hospitalName, reportId) => {
  return createNotification({
    recipientId: adminId,
    type: 'REPORT_SUBMITTED',
    title: 'Audit Report Submitted',
    message: `Report for ${auditNumber} (${hospitalName}) has been submitted for review.`,
    relatedEntity: 'AuditReport',
    relatedEntityId: reportId,
  });
};

const notifyReportReturned = async (teamLeadId, auditNumber, comments, reportId) => {
  return createNotification({
    recipientId: teamLeadId,
    type: 'REPORT_RETURNED',
    title: 'Report Returned for Correction',
    message: `Report for ${auditNumber} has been returned. Comments: ${comments}`,
    relatedEntity: 'AuditReport',
    relatedEntityId: reportId,
  });
};

const notifyReportApproved = async (teamLeadId, auditNumber, reportId) => {
  return createNotification({
    recipientId: teamLeadId,
    type: 'REPORT_APPROVED',
    title: 'Audit Report Approved',
    message: `Your report for audit ${auditNumber} has been approved and the audit is now closed.`,
    relatedEntity: 'AuditReport',
    relatedEntityId: reportId,
  });
};

const notifyReassignmentRequested = async (adminId, auditNumber, teamName, reason, assignmentId) => {
  return createNotification({
    recipientId: adminId,
    type: 'REASSIGNMENT_REQUESTED',
    title: 'Reassignment Requested',
    message: `Team "${teamName}" has requested reassignment for audit ${auditNumber}. Reason: ${reason}`,
    relatedEntity: 'Assignment',
    relatedEntityId: assignmentId,
  });
};

const notifyReassignmentApproved = async (teamLeadId, auditNumber, assignmentId) => {
  return createNotification({
    recipientId: teamLeadId,
    type: 'REASSIGNMENT_APPROVED',
    title: 'Reassignment Approved',
    message: `Your reassignment request for audit ${auditNumber} has been approved.`,
    relatedEntity: 'Assignment',
    relatedEntityId: assignmentId,
  });
};

const notifyAuditCancelled = async (teamLeadId, auditNumber, reason, auditId) => {
  return createNotification({
    recipientId: teamLeadId,
    type: 'AUDIT_CANCELLED',
    title: 'Audit Cancelled',
    message: `Audit ${auditNumber} has been cancelled. Reason: ${reason}`,
    relatedEntity: 'Audit',
    relatedEntityId: auditId,
  });
};

module.exports = {
  createNotification,
  notifyNewAssignment,
  notifyBatchAssignment,
  notifyReportSubmitted,
  notifyReportReturned,
  notifyReportApproved,
  notifyReassignmentRequested,
  notifyReassignmentApproved,
  notifyAuditCancelled,
};
