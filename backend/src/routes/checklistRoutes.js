const express = require('express');
const router = express.Router();
const {
  getTemplates,
  createTemplate,
  updateTemplate,
  getAuditChecklist,
  saveResponse,
  submitChecklist,
} = require('../controllers/checklistController');
const { protect, authorize } = require('../middleware/auth');
const { authorizeAuditAccess } = require('../middleware/auditAccess');

router.use(protect);

// Template routes
router.get('/templates', authorize('ADMIN'), getTemplates);
router.post('/templates', authorize('ADMIN'), createTemplate);
router.put('/templates/:id', authorize('ADMIN'), updateTemplate);

// Audit checklist routes
router.get('/audit/:auditId', authorizeAuditAccess, getAuditChecklist);
router.post('/audit/:auditId/response', authorizeAuditAccess, saveResponse);
router.post('/audit/:auditId/submit', authorizeAuditAccess, submitChecklist);

module.exports = router;
