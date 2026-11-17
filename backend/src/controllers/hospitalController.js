const Hospital = require('../models/Hospital');
const Audit = require('../models/Audit');
const { logAction } = require('../utils/auditLogger');

// Generate a facility ID from state and district
const generateFacilityId = async (state, district) => {
  const stateCode = (state || 'XX').replace(/\s+/g, '').substring(0, 3).toUpperCase();
  const distCode = (district || 'XXX').replace(/\s+/g, '').substring(0, 3).toUpperCase();
  const prefix = `${stateCode}-${distCode}-H-`;

  const latest = await Hospital.findOne(
    { facilityId: { $regex: `^${prefix}` } },
    { facilityId: 1 },
    { sort: { facilityId: -1 } }
  );

  let seq = 1;
  if (latest && latest.facilityId) {
    const parts = latest.facilityId.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(4, '0')}`;
};

// GET /api/v1/hospitals
const getHospitals = async (req, res) => {
  const {
    search,
    state,
    district,
    facilityType,
    hospitalType,
    auditPriority,
    riskCategory,
    isActive,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query;

  const filter = {};

  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (state) filter.state = { $regex: state, $options: 'i' };
  if (district) filter.district = { $regex: district, $options: 'i' };
  if (facilityType) filter.facilityType = facilityType;
  if (hospitalType) filter.hospitalType = hospitalType;
  if (auditPriority) filter.auditPriority = auditPriority;
  if (riskCategory) filter.riskCategory = riskCategory;

  if (req.query.speciality) filter.specialities = { $regex: req.query.speciality, $options: 'i' };

  if (search) {
    filter.$or = [
      { facilityId: { $regex: search, $options: 'i' } },
      { facilityName: { $regex: search, $options: 'i' } },
      { district: { $regex: search, $options: 'i' } },
      { nodalOfficerName: { $regex: search, $options: 'i' } },
      { specialities: { $regex: search, $options: 'i' } },
    ];
  }

  const sortDir = sortOrder === 'asc' ? 1 : -1;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [hospitals, total] = await Promise.all([
    Hospital.find(filter)
      .sort({ [sortBy]: sortDir })
      .skip(skip)
      .limit(parseInt(limit)),
    Hospital.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    hospitals,
  });
};

// GET /api/v1/hospitals/:id
const getHospital = async (req, res) => {
  const { id } = req.params;

  // Support lookup by MongoDB _id or facilityId
  const hospital = await Hospital.findOne({
    $or: [
      { _id: id.match(/^[a-fA-F0-9]{24}$/) ? id : null },
      { facilityId: id },
    ],
  });

  if (!hospital) {
    return res.status(404).json({ success: false, message: 'Hospital not found.' });
  }

  return res.status(200).json({ success: true, hospital });
};

// POST /api/v1/hospitals  (admin only)
const createHospital = async (req, res) => {
  // Auto-generate facilityId if not provided
  if (!req.body.facilityId) {
    req.body.facilityId = await generateFacilityId(req.body.state, req.body.district);
  }

  const hospital = await Hospital.create({
    ...req.body,
    source: 'MANUAL',
  });

  await logAction({
    userId: req.user._id,
    userRole: req.user.role,
    action: 'HOSPITAL_CREATED',
    entity: 'Hospital',
    entityId: hospital._id,
    newValue: { facilityId: hospital.facilityId, facilityName: hospital.facilityName },
    req,
  });

  return res.status(201).json({ success: true, message: 'Hospital created.', hospital });
};

// PUT /api/v1/hospitals/:id  (admin only)
const updateHospital = async (req, res) => {
  const { id } = req.params;

  const hospital = await Hospital.findById(id);
  if (!hospital) {
    return res.status(404).json({ success: false, message: 'Hospital not found.' });
  }

  const immutableFields = ['facilityId', '_id', 'importBatchId', 'importedBy', 'importedAt', 'source'];
  const oldValue = hospital.toObject();

  immutableFields.forEach((f) => delete req.body[f]);

  Object.assign(hospital, req.body);
  await hospital.save();

  await logAction({
    userId: req.user._id,
    userRole: req.user.role,
    action: 'HOSPITAL_UPDATED',
    entity: 'Hospital',
    entityId: hospital._id,
    oldValue: { facilityName: oldValue.facilityName, district: oldValue.district, auditPriority: oldValue.auditPriority },
    newValue: { facilityName: hospital.facilityName, district: hospital.district, auditPriority: hospital.auditPriority },
    req,
  });

  return res.status(200).json({ success: true, message: 'Hospital updated.', hospital });
};

// DELETE /api/v1/hospitals/:id  (soft delete, admin only)
const deleteHospital = async (req, res) => {
  const { id } = req.params;

  const hospital = await Hospital.findById(id);
  if (!hospital) {
    return res.status(404).json({ success: false, message: 'Hospital not found.' });
  }

  hospital.isActive = false;
  await hospital.save();

  await logAction({
    userId: req.user._id,
    userRole: req.user.role,
    action: 'HOSPITAL_DEACTIVATED',
    entity: 'Hospital',
    entityId: hospital._id,
    oldValue: { isActive: true },
    newValue: { isActive: false },
    req,
  });

  return res.status(200).json({ success: true, message: 'Hospital deactivated.' });
};

// GET /api/v1/hospitals/:id/audits
const getHospitalAuditHistory = async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const hospital = await Hospital.findById(id);
  if (!hospital) {
    return res.status(404).json({ success: false, message: 'Hospital not found.' });
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [audits, total] = await Promise.all([
    Audit.find({ hospital: id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'name email'),
    Audit.countDocuments({ hospital: id }),
  ]);

  return res.status(200).json({
    success: true,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    audits,
  });
};

// POST /api/v1/hospitals/bulk  (admin only)
const bulkOperation = async (req, res) => {
  const { hospitalIds, operation, value } = req.body;

  if (!hospitalIds || !Array.isArray(hospitalIds) || hospitalIds.length === 0) {
    return res.status(400).json({ success: false, message: 'hospitalIds array is required.' });
  }

  const VALID_OPERATIONS = ['setStatus', 'setPriority', 'setRiskCategory'];
  if (!VALID_OPERATIONS.includes(operation)) {
    return res.status(400).json({ success: false, message: `Invalid operation. Valid: ${VALID_OPERATIONS.join(', ')}` });
  }

  let updateField = {};
  if (operation === 'setStatus') updateField = { isActive: value === true || value === 'true' };
  if (operation === 'setPriority') updateField = { auditPriority: value };
  if (operation === 'setRiskCategory') updateField = { riskCategory: value };

  const result = await Hospital.updateMany(
    { _id: { $in: hospitalIds } },
    { $set: updateField }
  );

  await logAction({
    userId: req.user._id,
    userRole: req.user.role,
    action: 'HOSPITAL_BULK_UPDATE',
    entity: 'Hospital',
    newValue: { operation, value, count: result.modifiedCount },
    req,
  });

  return res.status(200).json({
    success: true,
    message: `Bulk operation '${operation}' applied to ${result.modifiedCount} hospital(s).`,
    modifiedCount: result.modifiedCount,
  });
};

module.exports = {
  getHospitals,
  getHospital,
  createHospital,
  updateHospital,
  deleteHospital,
  getHospitalAuditHistory,
  bulkOperation,
};
