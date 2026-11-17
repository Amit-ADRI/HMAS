const mongoose = require('mongoose');

const acknowledgementHistorySchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
    reason: { type: String },
    reassignmentReason: { type: String },
  },
  { _id: false }
);

const reassignmentHistorySchema = new mongoose.Schema(
  {
    fromTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    toTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    requestedAt: { type: Date },
    reason: { type: String },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
  },
  { _id: false }
);

const assignmentSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: String,
      unique: true,
      index: true,
    },
    // Links the per-hospital assignments that were issued together for one
    // multi-hospital audit process.
    auditBatchId: {
      type: String,
      index: true,
    },
    audit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Audit',
      required: [true, 'Audit reference is required'],
      index: true,
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital',
      required: [true, 'Hospital reference is required'],
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'Team reference is required'],
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    expectedAuditDate: {
      type: Date,
    },
    acknowledgementDeadline: {
      type: Date,
    },
    acknowledgedAt: {
      type: Date,
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    priority: {
      type: String,
      enum: ['Low', 'Normal', 'High', 'Critical'],
      default: 'Normal',
    },
    instructions: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: [
        'PENDING',
        'ACCEPTED',
        'REASSIGNMENT_REQUESTED',
        'REASSIGNED',
        'CANCELLED',
      ],
      default: 'PENDING',
      index: true,
    },
    acknowledgementHistory: {
      type: [acknowledgementHistorySchema],
      default: [],
    },
    reassignmentHistory: {
      type: [reassignmentHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Assignment', assignmentSchema);
