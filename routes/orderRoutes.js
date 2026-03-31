const express = require('express');
const {
  getOrders,
  getOrder,
  createOrder,
  updateOrder,
  cancelOrder,
  deleteOrder
} = require('../controllers/orderController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(protect);

router.route('/')
  .get(getOrders)
  .post(createOrder);

router.route('/:id')
  .get(getOrder)
  .put(updateOrder)
  .delete(deleteOrder);

router.post('/:id/cancel', cancelOrder);

module.exports = router;
