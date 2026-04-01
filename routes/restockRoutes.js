const express = require('express');
const {
  getRestockQueue,
  restockProduct,
  removeFromQueue
} = require('../controllers/restockController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(protect);

// All authenticated users can manage restock queue
// Users manage their own products; admins can manage all
router.get('/', getRestockQueue);
router.post('/:id/restock', restockProduct);
router.delete('/:id', removeFromQueue);

module.exports = router;
