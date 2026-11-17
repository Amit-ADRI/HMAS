const express = require('express');
const router = express.Router();
const {
  getAllSettings,
  getSetting,
  updateSetting,
  createSetting,
  deleteSetting,
} = require('../controllers/settingsController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', getAllSettings);
router.post('/', authorize('ADMIN'), createSetting);
router.get('/:key', getSetting);
router.put('/:key', authorize('ADMIN'), updateSetting);
router.delete('/:key', authorize('ADMIN'), deleteSetting);

module.exports = router;
