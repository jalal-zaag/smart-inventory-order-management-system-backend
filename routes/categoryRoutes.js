const express = require('express');
const {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory
} = require('../controllers/categoryController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(protect);

router.route('/')
  .get(getCategories)
  .post(authorize('admin', 'manager'), createCategory);

router.route('/:id')
  .get(getCategory)
  .put(authorize('admin', 'manager'), updateCategory)
  .delete(authorize('admin'), deleteCategory);

module.exports = router;
