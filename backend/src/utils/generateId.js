const Audit = require('../models/Audit');
const Assignment = require('../models/Assignment');
const Finding = require('../models/Finding');
const User = require('../models/User');
const Team = require('../models/Team');
const ImportBatch = require('../models/ImportBatch');

const padNum = (num, length = 6) => String(num).padStart(length, '0');

const getCurrentYear = () => new Date().getFullYear();

/**
 * Generates audit number: AUD/{year}/{stateCode}/{districtCode}/{5-digit-seq}
 * e.g. AUD/2026/BIH/PAT/000129
 */
const generateAuditNumber = async (stateCode = 'XX', districtCode = 'XXX') => {
  const year = getCurrentYear();
  const prefix = `AUD/${year}/${stateCode.toUpperCase()}/${districtCode.toUpperCase()}/`;

  // Find latest audit number with same prefix
  const latest = await Audit.findOne(
    { auditNumber: { $regex: `^${prefix}` } },
    { auditNumber: 1 },
    { sort: { auditNumber: -1 } }
  );

  let seq = 1;
  if (latest && latest.auditNumber) {
    const parts = latest.auditNumber.split('/');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}${padNum(seq, 6)}`;
};

/**
 * Generates assignment ID: ASGN-{year}-{6-digit-seq}
 * e.g. ASGN-2026-000129
 */
const generateAssignmentId = async () => {
  const year = getCurrentYear();
  const prefix = `ASGN-${year}-`;

  const latest = await Assignment.findOne(
    { assignmentId: { $regex: `^${prefix}` } },
    { assignmentId: 1 },
    { sort: { assignmentId: -1 } }
  );

  let seq = 1;
  if (latest && latest.assignmentId) {
    const parts = latest.assignmentId.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}${padNum(seq, 6)}`;
};

/**
 * Generates finding ID: FND-{year}-{4-digit-seq}
 * e.g. FND-2026-0027
 */
const generateFindingId = async () => {
  const year = getCurrentYear();
  const prefix = `FND-${year}-`;

  const latest = await Finding.findOne(
    { findingId: { $regex: `^${prefix}` } },
    { findingId: 1 },
    { sort: { findingId: -1 } }
  );

  let seq = 1;
  if (latest && latest.findingId) {
    const parts = latest.findingId.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}${padNum(seq, 4)}`;
};

/**
 * Generates user ID: USR-{year}-{4-digit-seq}
 * e.g. USR-2026-0001
 */
const generateUserId = async () => {
  const year = getCurrentYear();
  const prefix = `USR-${year}-`;

  const latest = await User.findOne(
    { userId: { $regex: `^${prefix}` } },
    { userId: 1 },
    { sort: { userId: -1 } }
  );

  let seq = 1;
  if (latest && latest.userId) {
    const parts = latest.userId.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}${padNum(seq, 4)}`;
};

/**
 * Generates team ID: TM-{year}-{3-digit-seq}
 * e.g. TM-2026-001
 */
const generateTeamId = async () => {
  const year = getCurrentYear();
  const prefix = `TM-${year}-`;

  const latest = await Team.findOne(
    { teamId: { $regex: `^${prefix}` } },
    { teamId: 1 },
    { sort: { teamId: -1 } }
  );

  let seq = 1;
  if (latest && latest.teamId) {
    const parts = latest.teamId.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}${padNum(seq, 3)}`;
};

/**
 * Generates import batch ID: BATCH-{year}-{6-digit-seq}
 */
const generateBatchId = async () => {
  const year = getCurrentYear();
  const prefix = `BATCH-${year}-`;

  const latest = await ImportBatch.findOne(
    { batchId: { $regex: `^${prefix}` } },
    { batchId: 1 },
    { sort: { batchId: -1 } }
  );

  let seq = 1;
  if (latest && latest.batchId) {
    const parts = latest.batchId.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}${padNum(seq, 6)}`;
};

module.exports = {
  generateAuditNumber,
  generateAssignmentId,
  generateFindingId,
  generateUserId,
  generateTeamId,
  generateBatchId,
};
