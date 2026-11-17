const express = require('express');
const router = express.Router();
const {
  getTeams,
  getTeam,
  getTeamAssignments,
  getMyTeam,
  updateMyTeamMembers,
  createTeam,
  updateTeam,
  deleteTeam,
  updateAvailability,
  getTeamWorkload,
} = require('../controllers/teamController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', getTeams);
router.post('/', authorize('ADMIN'), createTeam);
router.get('/:id/assignments', authorize('ADMIN'), getTeamAssignments);
router.get('/my-team', authorize('TEAM_LEAD'), getMyTeam);
router.put('/my-team/members', authorize('TEAM_LEAD'), updateMyTeamMembers);
router.get('/:id', getTeam);
router.put('/:id', authorize('ADMIN'), updateTeam);
router.delete('/:id', authorize('ADMIN'), deleteTeam);
router.patch('/:id/availability', updateAvailability);
router.get('/:id/workload', getTeamWorkload);

module.exports = router;
