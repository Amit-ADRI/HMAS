const express = require('express');
const router = express.Router();
const { getAdminDashboard, getTeamLeadDashboard } = require('../controllers/dashboardController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/admin', authorize('ADMIN'), getAdminDashboard);
router.get('/team-lead', authorize('TEAM_LEAD'), getTeamLeadDashboard);

module.exports = router;
