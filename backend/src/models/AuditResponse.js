const mongoose = require('mongoose');

const responseEntrySchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    sectionId: { type: String, required: true },
    responseValue: { type: mongoose.Schema.Types.Mixed },
    remarks: { type: String, trim: true },
    evidenceIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Evidence', default: [] },
    score: { type: Number },
    isCompliant: { type: Boolean },
  },
  { _id: false }
);

const auditResponseSchema = new mongoose.Schema(
  {
    audit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Audit',
      required: [true, 'Audit reference is required'],
      index: true,
    },
    template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChecklistTemplate',
    },
    // Immutable copy used by this audit, protecting completed work when an
    // admin later changes the source checklist template.
    templateSnapshot: { type: mongoose.Schema.Types.Mixed },
    templateVersion: { type: Number },
    responses: {
      type: [responseEntrySchema],
      default: [],
    },
    completedSections: {
      type: [String],
      default: [],
    },
    isComplete: {
      type: Boolean,
      default: false,
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AuditResponse', auditResponseSchema);
