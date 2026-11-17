const express = require('express');
const router = express.Router();
const {
  getHospitals,
  getHospital,
  createHospital,
  updateHospital,
  deleteHospital,
  getHospitalAuditHistory,
  bulkOperation,
} = require('../controllers/hospitalController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', getHospitals);
router.post('/', authorize('ADMIN'), createHospital);
router.post('/bulk', authorize('ADMIN'), bulkOperation);
router.get('/:id', getHospital);
router.put('/:id', authorize('ADMIN'), updateHospital);
router.delete('/:id', authorize('ADMIN'), deleteHospital);
router.get('/:id/audits', getHospitalAuditHistory);

module.exports = router;
