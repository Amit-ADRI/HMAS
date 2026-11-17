const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    mobile: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    role: { type: String, trim: true },
  },
  { _id: false }
);

const teamSchema = new mongoose.Schema(
  {
    teamId: {
      type: String,
      unique: true,
      index: true,
    },
    teamName: {
      type: String,
      required: [true, 'Team name is required'],
      trim: true,
    },
    teamLead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Team lead is required'],
    },
    teamLeadMobile: {
      type: String,
      trim: true,
    },
    teamLeadEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    members: {
      type: [memberSchema],
      default: [],
    },
    expertise: {
      type: [String],
      default: [],
    },
    preferredDistricts: {
      type: [String],
      default: [],
    },
    availability: {
      type: String,
      enum: [
        'Available',
        'Partially Available',
        'Busy',
        'On Audit',
        'On Leave',
        'Unavailable',
        'Inactive',
      ],
      default: 'Available',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Team', teamSchema);
