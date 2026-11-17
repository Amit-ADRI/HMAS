const mongoose = require('mongoose');

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
    reason: { type: String },
  },
  { _id: false }
);

const timelineEntrySchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedByRole: { type: String },
    timestamp: { type: Date, default: Date.now },
    details: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const auditSchema = new mongoose.Schema(
  {
    auditNumber: {
      type: String,
      unique: true,
      index: true,
    },
    // Shared only when an admin creates the same audit process for multiple hospitals.
    // Individual records retain their own status, evidence, findings and closure.
    auditBatchId: {
      type: String,
      index: true,
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital',
      required: [true, 'Hospital is required'],
      index: true,
    },
    auditType: {
      type: String,
      enum: ['Routine', 'Surprise', 'Complaint', 'Follow-up', 'Re-audit', 'Special', 'Verification'],
    },
    reason: {
      type: String,
      trim: true,
    },
    priority: {
      type: String,
      enum: ['Low', 'Normal', 'High', 'Critical'],
    },
    targetDate: {
      type: Date,
    },
    instructions: {
      type: String,
      trim: true,
    },
    isSuspicious: {
      type: Boolean,
    },
    suspicionRemarks: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: [
        'PLANNED',
        'UNASSIGNED',
        'ASSIGNED',
        'AWAITING_ACKNOWLEDGEMENT',
        'ACCEPTED',
        'SCHEDULED',
        'IN_PROGRESS',
        'COMPLETED',
        'SUBMITTED',
        'UNDER_REVIEW',
        'RETURNED',
        'APPROVED',
        'CLOSED',
        'ON_HOLD',
        'CANCELLED',
      ],
      default: 'PLANNED',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
    activityTimeline: {
      type: [timelineEntrySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Method to add a timeline entry
auditSchema.methods.addTimelineEntry = async function (action, userId, role, details) {
  this.activityTimeline.push({
    action,
    performedBy: userId,
    performedByRole: role,
    timestamp: new Date(),
    details,
  });
  return this.save();
};

module.exports = mongoose.model('Audit', auditSchema);
