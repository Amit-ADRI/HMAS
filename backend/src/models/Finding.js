const mongoose = require('mongoose');

const findingSchema = new mongoose.Schema(
  {
    findingId: {
      type: String,
      unique: true,
      index: true,
    },
    audit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Audit',
      required: [true, 'Audit reference is required'],
      index: true,
    },
    category: {
      type: String,
      trim: true,
      required: [true, 'Category is required'],
    },
    observation: {
      type: String,
      required: [true, 'Observation is required'],
      trim: true,
    },
    severity: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      required: [true, 'Severity is required'],
    },
    recommendation: {
      type: String,
      trim: true,
    },
    evidenceIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'Evidence',
      default: [],
    },
    remarks: {
      type: String,
      trim: true,
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

module.exports = mongoose.model('Finding', findingSchema);
