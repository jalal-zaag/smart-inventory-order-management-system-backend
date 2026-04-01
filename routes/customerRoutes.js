const express = require('express');
const {
  getCustomers,
  getCustomer,
  updateCustomer,
  deleteCustomer
} = require('../controllers/customerController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication AND admin role
router.use(protect);
router.use(adminOnly);

// Admin-only customer (user) management routes
// Note: Customer creation happens through user registration (/api/auth/register)
router.route('/')
  .get(getCustomers);

router.route('/:id')
  .get(getCustomer)
  .put(updateCustomer)
  .delete(deleteCustomer);

module.exports = router;
