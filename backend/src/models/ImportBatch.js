const mongoose = require('mongoose');

const errorReportEntrySchema = new mongoose.Schema(
  {
    row: { type: Number },
    facilityId: { type: String },
    field: { type: String },
    error: { type: String },
    data: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const importBatchSchema = new mongoose.Schema(
  {
    batchId: {
      type: String,
      unique: true,
      index: true,
    },
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    importedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    importedAt: {
      type: Date,
      default: Date.now,
    },
    totalRecords: {
      type: Number,
      default: 0,
    },
    added: {
      type: Number,
      default: 0,
    },
    updated: {
      type: Number,
      default: 0,
    },
    skipped: {
      type: Number,
      default: 0,
    },
    failed: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'PROCESSING',
    },
    errorReport: {
      type: [errorReportEntrySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('ImportBatch', importBatchSchema);
