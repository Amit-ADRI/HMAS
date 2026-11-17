const mongoose = require('mongoose');

const reportVersionSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    submittedAt: { type: Date },
    status: {
      type: String,
      enum: ['DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED'],
      default: 'DRAFT',
    },
    reviewComments: { type: String, trim: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reportData: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const auditReportSchema = new mongoose.Schema(
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
    },
    versions: {
      type: [reportVersionSchema],
      default: [],
    },
    currentVersion: {
      type: Number,
      default: 1,
    },
    currentStatus: {
      type: String,
      enum: ['DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED'],
      default: 'DRAFT',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    closedAt: {
      type: Date,
    },
    uploadedFile: {
      filename: String,
      originalName: String,
      mimeType: String,
      size: Number,
      uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      uploadedAt: Date,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AuditReport', auditReportSchema);
