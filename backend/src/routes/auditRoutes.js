const express = require('express');
const router = express.Router();
const {
  getAudits,
  getAuditBatches,
  getAudit,
  saveAuditAssessment,
  downloadAuditOrderPdf,
  createAudit,
  updateAudit,
  cancelAudit,
  holdAudit,
  resumeAudit,
  getAuditTimeline,
} = require('../controllers/auditController');
const { getFindings, createFinding, updateFinding, deleteFinding } = require('../controllers/findingController');
const {
  uploadMiddleware,
  uploadEvidence,
  getEvidence,
  downloadEvidence,
  deleteEvidence,
} = require('../controllers/evidenceController');
const { protect, authorize } = require('../middleware/auth');
const { authorizeAuditAccess } = require('../middleware/auditAccess');

router.use(protect);

// Audit CRUD
router.get('/', getAudits);
router.get('/batches', authorize('ADMIN'), getAuditBatches);
router.post('/', authorize('ADMIN'), createAudit);
router.get('/:id', getAudit);
router.get('/:id/order-pdf', authorizeAuditAccess, downloadAuditOrderPdf);
router.post('/:id/assessment', authorize('TEAM_LEAD'), authorizeAuditAccess, saveAuditAssessment);
router.put('/:id', authorize('ADMIN'), updateAudit);
router.post('/:id/cancel', authorize('ADMIN'), cancelAudit);
router.post('/:id/hold', authorize('ADMIN'), holdAudit);
router.post('/:id/resume', authorize('ADMIN'), resumeAudit);
router.get('/:id/timeline', authorizeAuditAccess, getAuditTimeline);

// Findings (nested under audits)
router.use('/:auditId/findings', authorizeAuditAccess);
router.get('/:auditId/findings', getFindings);
router.post('/:auditId/findings', authorize('TEAM_LEAD', 'ADMIN'), createFinding);
router.put('/:auditId/findings/:findingId', updateFinding);
router.delete('/:auditId/findings/:findingId', deleteFinding);

// Evidence (nested under audits)
router.use('/:auditId/evidence', authorizeAuditAccess);
router.get('/:auditId/evidence', getEvidence);
router.post('/:auditId/evidence', authorize('TEAM_LEAD', 'ADMIN'), uploadMiddleware, uploadEvidence);
router.get('/:auditId/evidence/:evidenceId/download', downloadEvidence);
router.delete('/:auditId/evidence/:evidenceId', deleteEvidence);

module.exports = router;
