const path = require('path');
const fs = require('fs');
const multer = require('multer');
const XLSX = require('xlsx');
const Hospital = require('../models/Hospital');
const ImportBatch = require('../models/ImportBatch');
const { generateBatchId } = require('../utils/generateId');
const { logAction } = require('../utils/auditLogger');

// Multer setup for import files
const importStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const importDir = path.join(__dirname, '../../../uploads/imports');
    if (!fs.existsSync(importDir)) fs.mkdirSync(importDir, { recursive: true });
    cb(null, importDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `import-${Date.now()}${ext}`);
  },
});

const importUpload = multer({
  storage: importStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedMimes = [
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowed.includes(ext) || allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV or Excel (.xlsx/.xls) files are supported for import.'));
    }
  },
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

// Parse file — supports both CSV and XLSX
const parseFile = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (rawRows.length < 2) return { headers: [], rows: [] };

  const headers = rawRows[0].map((h) => String(h).trim());
  const rows = rawRows.slice(1).map((cols, idx) => {
    const row = { _rowNumber: idx + 2 };
    headers.forEach((header, i) => {
      row[header] = cols[i] !== undefined ? String(cols[i]).trim() : '';
    });
    return row;
  });

  return { headers, rows };
};

// Map Excel row (using exact column names from SEC Officer_Empanelled file)
// Also handles generic CSV column variations
const mapRowToHospital = (row) => {
  const specialitiesRaw =
    row['Specialities Selected'] || row.specialities || row.Specialities || row.specialty || '';
  const specialities = specialitiesRaw
    ? specialitiesRaw.split(/[;,]/).map((s) => s.trim()).filter(Boolean)
    : [];

  return {
    facilityId: (row['Facility ID'] || row.facilityId || row.facility_id || '').trim(),
    facilityName: (row['Facility Name'] || row.facilityName || row.facility_name || '').trim(),
    facilityType: (row['Facility Type'] || row.facilityType || row.facility_type || '').trim(),
    state: (row['State'] || row.state || '').trim(),
    district: (row['District'] || row.district || '').trim(),
    specialities,
    hospitalType: (row['Hospital Type'] || row.hospitalType || row.hospital_type || '').trim(),
    totalBedStrength: parseInt(row['Total Bed Strength'] || row.totalBedStrength || row['Total Beds'] || 0, 10) || undefined,
    nodalOfficerName: (row['Nodal Officer Name'] || row.nodalOfficerName || '').trim(),
    nodalOfficerNumber: String(row['Nodal Officer Number'] || row.nodalOfficerNumber || '').trim(),
    nodalOfficerEmail: (row['Nodal Officer Email'] || row.nodalOfficerEmail || '').trim(),
    schemeCode: (row['Scheme Code'] || row.schemeCode || row.scheme_code || '').trim(),
    address: (row['Address'] || row.address || '').trim(),
    pinCode: (row['PIN Code'] || row['Pin Code'] || row.pinCode || '').trim(),
    latitude: parseFloat(row['Latitude'] || row.latitude || row.lat) || undefined,
    longitude: parseFloat(row['Longitude'] || row.longitude || row.lng) || undefined,
    auditPriority: (row.auditPriority || row.audit_priority || 'NORMAL').toUpperCase(),
    riskCategory: (row.riskCategory || row.risk_category || 'MEDIUM').toUpperCase(),
  };
};

// Validate a hospital row
const validateRow = (data, rowNumber) => {
  const errors = [];
  if (!data.facilityId) errors.push({ field: 'facilityId', error: 'Required field missing' });
  if (!data.facilityName) errors.push({ field: 'facilityName', error: 'Required field missing' });
  if (!data.state) errors.push({ field: 'state', error: 'Required field missing' });
  if (!data.district) errors.push({ field: 'district', error: 'Required field missing' });
  return errors;
};

// POST /api/v1/imports/upload
const uploadFile = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded.' });
  }

  const { headers, rows } = parseFile(req.file.path);
  const mappedRows = rows.map((row) => mapRowToHospital(row));
  const hasFacilityIds = mappedRows.some((r) => r.facilityId);

  if (!hasFacilityIds) {
    return res.status(400).json({
      success: false,
      message: 'File is missing required columns. Expected: "Facility ID", "Facility Name", "State", "District".',
      detectedHeaders: headers,
    });
  }

  return res.status(200).json({
    success: true,
    message: 'File uploaded and validated.',
    filename: req.file.filename,
    totalRows: rows.length,
    detectedHeaders: headers,
    sampleRow: mappedRows[0] || null,
  });
};

// POST /api/v1/imports/preview
const previewImport = async (req, res) => {
  const { filename } = req.body;

  if (!filename) {
    return res.status(400).json({ success: false, message: 'filename is required.' });
  }

  const filePath = path.join(__dirname, '../../../uploads/imports', filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'File not found. Please upload again.' });
  }

  const { rows } = parseFile(filePath);

  const preview = {
    total: rows.length,
    new: 0,
    updated: 0,
    unchanged: 0,
    invalid: 0,
    duplicates: 0,
    records: [],
    errors: [],
  };

  for (const row of rows) {
    const data = mapRowToHospital(row);
    const errors = validateRow(data, row._rowNumber);

    if (errors.length > 0) {
      preview.invalid++;
      preview.errors.push({ row: row._rowNumber, facilityId: data.facilityId, errors });
      preview.records.push({ ...data, _status: 'INVALID', _rowNumber: row._rowNumber, _errors: errors });
      continue;
    }

    const existing = await Hospital.findOne({ facilityId: data.facilityId });

    if (!existing) {
      preview.new++;
      preview.records.push({ ...data, _status: 'NEW', _rowNumber: row._rowNumber });
    } else {
      // Simple check: compare a few key fields
      const changed =
        existing.facilityName !== data.facilityName ||
        existing.district !== data.district ||
        existing.nodalOfficerName !== data.nodalOfficerName;

      if (changed) {
        preview.updated++;
        preview.records.push({ ...data, _status: 'UPDATE', _rowNumber: row._rowNumber });
      } else {
        preview.unchanged++;
        preview.records.push({ ...data, _status: 'UNCHANGED', _rowNumber: row._rowNumber });
      }
    }
  }

  // Check for duplicates within the file
  const facilityIds = rows.map((r) => mapRowToHospital(r).facilityId).filter(Boolean);
  const seen = new Set();
  for (const id of facilityIds) {
    if (seen.has(id)) preview.duplicates++;
    seen.add(id);
  }

  return res.status(200).json({ success: true, preview });
};

// POST /api/v1/imports/confirm
const confirmImport = async (req, res) => {
  const { filename } = req.body;

  if (!filename) {
    return res.status(400).json({ success: false, message: 'filename is required.' });
  }

  const filePath = path.join(__dirname, '../../../uploads/imports', filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'File not found.' });
  }

  const batchId = await generateBatchId();
  const batch = await ImportBatch.create({
    batchId,
    filename,
    importedBy: req.user._id,
    importedAt: new Date(),
    status: 'PROCESSING',
  });

  const { rows } = parseFile(filePath);

  let added = 0, updated = 0, skipped = 0, failed = 0;
  const errorReport = [];

  for (const row of rows) {
    const data = mapRowToHospital(row);
    const errors = validateRow(data, row._rowNumber);

    if (errors.length > 0 || !data.facilityId) {
      failed++;
      errorReport.push({
        row: row._rowNumber,
        facilityId: data.facilityId || 'N/A',
        error: errors.map((e) => `${e.field}: ${e.error}`).join('; '),
        data,
      });
      continue;
    }

    try {
      const existing = await Hospital.findOne({ facilityId: data.facilityId });

      if (!existing) {
        await Hospital.create({
          ...data,
          importBatchId: batchId,
          importedBy: req.user._id,
          importedAt: new Date(),
          source: 'IMPORT',
          isActive: true,
        });
        added++;
      } else {
        const changed =
          existing.facilityName !== data.facilityName ||
          existing.district !== data.district ||
          existing.nodalOfficerName !== data.nodalOfficerName;

        if (changed) {
          await Hospital.findByIdAndUpdate(existing._id, {
            ...data,
            importBatchId: batchId,
            importedAt: new Date(),
          });
          updated++;
        } else {
          skipped++;
        }
      }
    } catch (err) {
      failed++;
      errorReport.push({
        row: row._rowNumber,
        facilityId: data.facilityId,
        error: err.message,
        data,
      });
    }
  }

  batch.totalRecords = rows.length;
  batch.added = added;
  batch.updated = updated;
  batch.skipped = skipped;
  batch.failed = failed;
  batch.status = failed > 0 && added + updated === 0 ? 'FAILED' : 'COMPLETED';
  batch.errorReport = errorReport;
  await batch.save();

  await logAction({
    userId: req.user._id,
    userRole: req.user.role,
    action: 'HOSPITALS_IMPORTED',
    entity: 'ImportBatch',
    entityId: batch._id,
    newValue: { batchId, added, updated, skipped, failed, total: rows.length },
    req,
  });

  return res.status(200).json({
    success: true,
    message: 'Import completed.',
    batch: {
      batchId,
      totalRecords: rows.length,
      added,
      updated,
      skipped,
      failed,
      status: batch.status,
    },
  });
};

// GET /api/v1/imports
const getImportHistory = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [batches, total] = await Promise.all([
    ImportBatch.find({})
      .populate('importedBy', 'name email')
      .sort({ importedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    ImportBatch.countDocuments({}),
  ]);

  return res.status(200).json({
    success: true,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    batches,
  });
};

// GET /api/v1/imports/:batchId
const getImportBatch = async (req, res) => {
  const batch = await ImportBatch.findOne({ batchId: req.params.batchId }).populate('importedBy', 'name email');

  if (!batch) {
    return res.status(404).json({ success: false, message: 'Import batch not found.' });
  }

  return res.status(200).json({ success: true, batch });
};

// GET /api/v1/imports/:batchId/error-report
const downloadErrorReport = async (req, res) => {
  const batch = await ImportBatch.findOne({ batchId: req.params.batchId });

  if (!batch) {
    return res.status(404).json({ success: false, message: 'Import batch not found.' });
  }

  if (!batch.errorReport || batch.errorReport.length === 0) {
    return res.status(200).json({ success: true, message: 'No errors in this batch.', csv: '' });
  }

  const headers = ['Row', 'FacilityID', 'FacilityName', 'State', 'District', 'Error'];
  const csvRows = batch.errorReport.map((e) =>
    [
      e.row,
      e.facilityId || '',
      e.data?.facilityName || '',
      e.data?.state || '',
      e.data?.district || '',
      `"${(e.error || '').replace(/"/g, '""')}"`,
    ].join(',')
  );

  const csvContent = [headers.join(','), ...csvRows].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="error-report-${req.params.batchId}.csv"`);
  return res.send(csvContent);
};

module.exports = {
  importUpload,
  uploadFile,
  previewImport,
  confirmImport,
  getImportHistory,
  getImportBatch,
  downloadErrorReport,
};
