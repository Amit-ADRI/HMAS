const mongoose = require('mongoose');

const scheduleHistorySchema = new mongoose.Schema(
  {
    scheduledDate: { type: Date },
    startTime: { type: String },
    reason: { type: String },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const auditScheduleSchema = new mongoose.Schema(
  {
    audit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Audit',
      required: [true, 'Audit reference is required'],
      index: true,
    },
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: [true, 'Assignment reference is required'],
    },
    scheduledDate: {
      type: Date,
      required: [true, 'Scheduled date is required'],
    },
    startTime: {
      type: String,
      trim: true,
    },
    expectedDuration: {
      type: Number, // in hours
      min: [0.5, 'Expected duration must be at least 0.5 hours'],
    },
    remarks: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['SCHEDULED', 'RESCHEDULED', 'CANCELLED', 'COMPLETED'],
      default: 'SCHEDULED',
    },
    scheduleHistory: {
      type: [scheduleHistorySchema],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AuditSchedule', auditScheduleSchema);
