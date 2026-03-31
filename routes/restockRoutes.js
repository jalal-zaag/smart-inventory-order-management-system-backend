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

router.get('/', getRestockQueue);
router.post('/:id/restock', restockProduct);
router.delete('/:id', removeFromQueue);

module.exports = router;
