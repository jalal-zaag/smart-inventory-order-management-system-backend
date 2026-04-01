const express = require('express');
const {
  getActivityLogs,
  getActivityLog
} = require('../controllers/activityLogController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(protect);

// All authenticated users can view activity logs
// Users see their own; admins see all
router.route('/')
  .get(getActivityLogs);

router.route('/:id')
  .get(getActivityLog);

module.exports = router;
