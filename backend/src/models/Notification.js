const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient is required'],
      index: true,
    },
    type: {
      type: String,
      required: [true, 'Notification type is required'],
      enum: [
        'NEW_ASSIGNMENT',
        'ASSIGNMENT_CANCELLED',
        'REASSIGNMENT_REQUESTED',
        'REASSIGNMENT_APPROVED',
        'REPORT_SUBMITTED',
        'REPORT_RETURNED',
        'REPORT_APPROVED',
        'AUDIT_ON_HOLD',
        'AUDIT_CANCELLED',
        'AUDIT_COMPLETED',
        'ACKNOWLEDGEMENT_OVERDUE',
        'GENERAL',
      ],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
    },
    relatedEntity: {
      type: String,
      enum: ['Audit', 'Assignment', 'AuditReport', 'Team', 'Hospital', 'User'],
    },
    relatedEntityId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
