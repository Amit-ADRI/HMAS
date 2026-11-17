const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema(
  {
    facilityId: {
      type: String,
      required: [true, 'Facility ID is required'],
      unique: true,
      trim: true,
      index: true,
    },
    facilityName: {
      type: String,
      required: [true, 'Facility name is required'],
      trim: true,
    },
    facilityType: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
      index: true,
    },
    district: {
      type: String,
      required: [true, 'District is required'],
      trim: true,
      index: true,
    },
    specialities: {
      type: [String],
      default: [],
    },
    hospitalType: {
      type: String,
      trim: true,
    },
    totalBedStrength: {
      type: Number,
      min: [0, 'Bed strength cannot be negative'],
    },
    nodalOfficerName: {
      type: String,
      trim: true,
    },
    nodalOfficerNumber: {
      type: String,
      trim: true,
    },
    nodalOfficerEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    schemeCode: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    pinCode: {
      type: String,
      trim: true,
      match: [/^\d{6}$/, 'Please provide a valid 6-digit pin code'],
    },
    latitude: {
      type: Number,
      min: [-90, 'Latitude must be >= -90'],
      max: [90, 'Latitude must be <= 90'],
    },
    longitude: {
      type: Number,
      min: [-180, 'Longitude must be >= -180'],
      max: [180, 'Longitude must be <= 180'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    riskCategory: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
    },
    auditPriority: {
      type: String,
      enum: ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'],
      default: 'NORMAL',
    },
    lastAuditDate: {
      type: Date,
    },
    lastAuditResult: {
      type: String,
    },
    nextAuditDue: {
      type: Date,
    },
    importBatchId: {
      type: String,
    },
    importedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    importedAt: {
      type: Date,
    },
    source: {
      type: String,
      enum: ['MANUAL', 'IMPORT', 'API'],
      default: 'MANUAL',
    },
  },
  {
    timestamps: true,
  }
);

hospitalSchema.index({ state: 1, district: 1 });
hospitalSchema.index({ facilityName: 'text', nodalOfficerName: 'text' });

module.exports = mongoose.model('Hospital', hospitalSchema);
