const mongoose = require('mongoose');

const conditionalLogicSchema = new mongoose.Schema(
  {
    triggerQuestionId: { type: String },
    triggerValue: { type: mongoose.Schema.Types.Mixed },
    action: { type: String, enum: ['SHOW', 'HIDE'] },
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    text: { type: String, required: true, trim: true },
    responseType: {
      type: String,
      enum: ['COMPLIANT_CHECK', 'TEXT', 'SCORE', 'SINGLE_CHOICE'],
      required: true,
    },
    options: { type: [String], default: [] },
    requiresRemark: { type: Boolean, default: false },
    requiresEvidence: { type: Boolean, default: false },
    isMandatory: { type: Boolean, default: true },
    conditionalLogic: { type: conditionalLogicSchema },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const sectionSchema = new mongoose.Schema(
  {
    sectionId: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    questions: { type: [questionSchema], default: [] },
  },
  { _id: false }
);

const checklistTemplateSchema = new mongoose.Schema(
  {
    templateName: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true,
    },
    auditType: {
      type: String,
      enum: ['Routine', 'Surprise', 'Complaint', 'Follow-up', 'Re-audit', 'Special', 'Verification'],
      required: [true, 'Audit type is required'],
    },
    sections: {
      type: [sectionSchema],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('ChecklistTemplate', checklistTemplateSchema);
