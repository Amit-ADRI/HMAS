const express = require('express');
const router = express.Router();
const {
  importUpload,
  uploadFile,
  previewImport,
  confirmImport,
  getImportHistory,
  getImportBatch,
  downloadErrorReport,
} = require('../controllers/importController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('ADMIN'));

router.post('/upload', importUpload.single('file'), uploadFile);
router.post('/preview', previewImport);
router.post('/confirm', confirmImport);
router.get('/', getImportHistory);
router.get('/:batchId', getImportBatch);
router.get('/:batchId/error-report', downloadErrorReport);

module.exports = router;
