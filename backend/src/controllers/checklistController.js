const ChecklistTemplate = require('../models/ChecklistTemplate');
const AuditResponse = require('../models/AuditResponse');
const Audit = require('../models/Audit');
const Evidence = require('../models/Evidence');
const { logAction } = require('../utils/auditLogger');

// GET /api/v1/checklists/templates
const getTemplates = async (req, res) => {
  const { auditType, isActive } = req.query;
  const filter = {};
  if (auditType) filter.auditType = auditType;
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  const templates = await ChecklistTemplate.find(filter)
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });

  return res.status(200).json({ success: true, templates });
};

// POST /api/v1/checklists/templates  (admin only)
const createTemplate = async (req, res) => {
  const { templateName, auditType, sections } = req.body;

  if (!templateName || !auditType) {
    return res.status(400).json({ success: false, message: 'templateName and auditType are required.' });
  }

  if (!sections || sections.length === 0) {
    return res.status(400).json({ success: false, message: 'At least one section is required.' });
  }

  // Validate section/question IDs are unique
  const allQuestionIds = sections.flatMap((s) => s.questions.map((q) => q.questionId));
  const uniqueIds = new Set(allQuestionIds);
  if (uniqueIds.size !== allQuestionIds.length) {
    return res.status(400).json({ success: false, message: 'Question IDs must be unique within the template.' });
  }

  const template = await ChecklistTemplate.create({
    templateName,
    auditType,
    sections,
    isActive: true,
    createdBy: req.user._id,
  });

  await logAction({
    userId: req.user._id,
    userRole: req.user.role,
    action: 'TEMPLATE_CREATED',
    entity: 'ChecklistTemplate',
    entityId: template._id,
    newValue: { templateName, auditType },
    req,
  });

  return res.status(201).json({ success: true, message: 'Template created.', template });
};

// PUT /api/v1/checklists/templates/:id  (admin only)
const updateTemplate = async (req, res) => {
  const template = await ChecklistTemplate.findById(req.params.id);

  if (!template) {
    return res.status(404).json({ success: false, message: 'Template not found.' });
  }

  const allowedFields = ['templateName', 'auditType', 'sections', 'isActive'];
  let contentChanged = false;
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      if (['templateName', 'auditType', 'sections'].includes(field)) contentChanged = true;
      template[field] = req.body[field];
    }
  });
  if (contentChanged) template.version = (template.version || 1) + 1;

  await template.save();

  return res.status(200).json({ success: true, message: 'Template updated.', template });
};

// GET /api/v1/checklists/audit/:auditId
const getAuditChecklist = async (req, res) => {
  const { auditId } = req.params;

  const audit = await Audit.findById(auditId);
  if (!audit) {
    return res.status(404).json({ success: false, message: 'Audit not found.' });
  }

  let auditResponse = await AuditResponse.findOne({ audit: auditId }).populate('template');

  // Auto-create if not exists
  if (!auditResponse) {
    // Find matching template for the audit type
    const template = await ChecklistTemplate.findOne({
      auditType: audit.auditType,
      isActive: true,
    });

    if (!template) {
      return res.status(400).json({ success: false, message: `No active checklist template exists for '${audit.auditType}' audits. Contact an administrator.` });
    }

    auditResponse = await AuditResponse.create({
      audit: auditId,
      template: template._id,
      templateVersion: template.version || 1,
      templateSnapshot: { templateName: template.templateName, auditType: template.auditType, version: template.version || 1, sections: template.sections },
      responses: [],
      completedSections: [],
      isComplete: false,
    });

    await auditResponse.populate('template');
  }

  const response = auditResponse.toObject();
  if (response.templateSnapshot) response.template = response.templateSnapshot;
  return res.status(200).json({ success: true, auditResponse: response });
};

// POST /api/v1/checklists/audit/:auditId/response
const saveResponse = async (req, res) => {
  const { auditId } = req.params;
  const { questionId, sectionId, responseValue, remarks, score, isCompliant } = req.body;

  if (!questionId || !sectionId) {
    return res.status(400).json({ success: false, message: 'questionId and sectionId are required.' });
  }

  const audit = await Audit.findById(auditId);
  if (!audit) {
    return res.status(404).json({ success: false, message: 'Audit not found.' });
  }

  if (!['IN_PROGRESS', 'RETURNED'].includes(audit.status)) {
    return res.status(400).json({ success: false, message: 'Audit must be IN_PROGRESS or RETURNED to save responses.' });
  }

  let auditResponse = await AuditResponse.findOne({ audit: auditId });
  if (!auditResponse) {
    return res.status(404).json({ success: false, message: 'Audit checklist not initialized. Fetch checklist first.' });
  }

  // Find and update or insert response
  const existingIdx = auditResponse.responses.findIndex((r) => r.questionId === questionId);
  const responseEntry = { questionId, sectionId, responseValue, remarks, score, isCompliant };

  if (existingIdx >= 0) {
    auditResponse.responses[existingIdx] = responseEntry;
  } else {
    auditResponse.responses.push(responseEntry);
  }

  // Track completed sections
  const sectionResponses = auditResponse.responses.filter((r) => r.sectionId === sectionId);
  const template = await ChecklistTemplate.findById(auditResponse.template);
  if (template) {
    const section = template.sections.find((s) => s.sectionId === sectionId);
    if (section) {
      const question = section.questions.find((item) => item.questionId === questionId);
      if (question?.requiresRemark && !remarks?.trim()) {
        return res.status(400).json({ success: false, message: 'Remarks are required for this question.' });
      }
      const mandatoryQuestions = section.questions.filter((q) => q.isMandatory);
      const answeredMandatory = mandatoryQuestions.filter((q) =>
        sectionResponses.some(
          (r) =>
            r.questionId === q.questionId &&
            r.responseValue !== null &&
            r.responseValue !== undefined &&
            r.responseValue !== ''
        )
      );

      if (answeredMandatory.length === mandatoryQuestions.length) {
        if (!auditResponse.completedSections.includes(sectionId)) {
          auditResponse.completedSections.push(sectionId);
        }
      } else {
        auditResponse.completedSections = auditResponse.completedSections.filter((s) => s !== sectionId);
      }
    }
  }

  await auditResponse.save();

  return res.status(200).json({ success: true, message: 'Response saved.', auditResponse });
};

// POST /api/v1/checklists/audit/:auditId/submit
const submitChecklist = async (req, res) => {
  const { auditId } = req.params;

  const audit = await Audit.findById(auditId);
  if (!audit) {
    return res.status(404).json({ success: false, message: 'Audit not found.' });
  }
  if (!['IN_PROGRESS', 'RETURNED'].includes(audit.status)) {
    return res.status(400).json({ success: false, message: 'Audit must be IN_PROGRESS or RETURNED to submit the checklist.' });
  }

  const auditResponse = await AuditResponse.findOne({ audit: auditId }).populate('template');
  if (!auditResponse) {
    return res.status(404).json({ success: false, message: 'Audit checklist not found.' });
  }

  // Validate all mandatory questions are answered
  if (auditResponse.template) {
    const allMandatoryIds = auditResponse.template.sections.flatMap((s) =>
      s.questions.filter((q) => q.isMandatory).map((q) => q.questionId)
    );

    const answeredIds = auditResponse.responses
      .filter((r) => r.responseValue !== null && r.responseValue !== undefined && r.responseValue !== '')
      .map((r) => r.questionId);

    const unanswered = allMandatoryIds.filter((id) => !answeredIds.includes(id));

    if (unanswered.length > 0) {
      return res.status(400).json({
        success: false,
        message: `${unanswered.length} mandatory question(s) not answered.`,
        unansweredQuestionIds: unanswered,
      });
    }

    const requiresEvidence = auditResponse.template.sections.some((section) => section.questions.some((question) => question.requiresEvidence));
    if (requiresEvidence) {
      const evidenceCount = await Evidence.countDocuments({ audit: auditId });
      if (!evidenceCount) return res.status(400).json({ success: false, message: 'At least one evidence file is required by this checklist.' });
    }
  }

  auditResponse.isComplete = true;
  auditResponse.completedBy = req.user._id;
  auditResponse.completedAt = new Date();
  await auditResponse.save();

  return res.status(200).json({ success: true, message: 'Checklist submitted successfully.', auditResponse });
};

module.exports = {
  getTemplates,
  createTemplate,
  updateTemplate,
  getAuditChecklist,
  saveResponse,
  submitChecklist,
};
