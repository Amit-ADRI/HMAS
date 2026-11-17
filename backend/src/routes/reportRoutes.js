const express = require('express');
const router = express.Router();
const {
  getReport,
  downloadReportPdf,
  downloadEvidencePackage,
  completeAudit,
  submitReport,
  returnReport,
  approveReport,
  reopenAudit,
  reportUpload,
  uploadReport,
  downloadReportFile,
} = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');
const { authorizeAuditAccess } = require('../middleware/auditAccess');

router.use(protect);

router.get('/:auditId', authorizeAuditAccess, getReport);
router.get('/:auditId/pdf', authorizeAuditAccess, downloadReportPdf);
router.get('/:auditId/evidence-package', authorizeAuditAccess, downloadEvidencePackage);
router.get('/:auditId/download-file', authorizeAuditAccess, downloadReportFile);
router.post('/:auditId/upload', authorize('TEAM_LEAD'), authorizeAuditAccess, reportUpload.single('file'), uploadReport);
router.post('/:auditId/complete', authorize('TEAM_LEAD'), authorizeAuditAccess, completeAudit);
router.post('/:auditId/submit', authorize('TEAM_LEAD'), authorizeAuditAccess, submitReport);
router.post('/:auditId/return', authorize('ADMIN'), returnReport);
router.post('/:auditId/approve', authorize('ADMIN'), approveReport);
router.post('/:auditId/reopen', authorize('ADMIN'), reopenAudit);

module.exports = router;
