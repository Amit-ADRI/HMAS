const express = require('express');
const router = express.Router();
const {
  createAssignment,
  getAssignment,
  getAssignments,
  getMyAssignments,
  acknowledgeAssignment,
  requestReassignment,
  approveReassignment,
  rejectReassignment,
  manuallyReassign,
  startAudit,
  getReassignmentRequests,
} = require('../controllers/assignmentController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Static routes first (before /:id)
router.get('/my-assignments', authorize('TEAM_LEAD'), getMyAssignments);
router.get('/reassignment-requests', authorize('ADMIN'), getReassignmentRequests);

router.post('/', authorize('ADMIN'), createAssignment);
router.get('/', authorize('ADMIN'), getAssignments);

// Parameterized routes
router.get('/:id', getAssignment);
router.post('/:id/acknowledge', authorize('TEAM_LEAD'), acknowledgeAssignment);
router.post('/:id/request-reassignment', authorize('TEAM_LEAD'), requestReassignment);
router.post('/:id/approve-reassignment', authorize('ADMIN'), approveReassignment);
router.post('/:id/reject-reassignment', authorize('ADMIN'), rejectReassignment);
router.post('/:id/reassign', authorize('ADMIN'), manuallyReassign);
router.post('/:id/start-audit', authorize('TEAM_LEAD'), startAudit);

module.exports = router;
