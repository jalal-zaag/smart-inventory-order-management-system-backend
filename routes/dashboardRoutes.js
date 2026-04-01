const express = require('express');
const {
  getDashboardStats,
  getRecentActivities,
  getChartData
} = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(protect);

router.get('/stats', getDashboardStats);
router.get('/activities', getRecentActivities);
router.get('/chart-data', getChartData);

module.exports = router;
