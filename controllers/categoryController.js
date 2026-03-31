const Category = require('../models/Category');
const ActivityLog = require('../models/ActivityLog');

// @desc    Get all categories
// @route   GET /api/categories
// @access  Private
exports.getCategories = async (req, res) => {
  try {
    const query = { owner: req.user._id };

    const categories = await Category.find(query).sort('-createdAt');

    res.status(200).json({
      success: true,
      count: categories.length,
      categories
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single category
// @route   GET /api/categories/:id
// @access  Private
exports.getCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ 
        success: false, 
        message: 'Category not found' 
      });
    }

    // Authorization check
    if (category.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to access this category' 
      });
    }

    res.status(200).json({
      success: true,
      category
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new category
// @route   POST /api/categories
// @access  Private
exports.createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    // Check if category already exists for this user
    const existingCategory = await Category.findOne({ 
      name: name.trim(), 
      owner: req.user._id 
    });

    if (existingCategory) {
      return res.status(400).json({ 
        success: false, 
        message: 'Category with this name already exists' 
      });
    }

    const category = await Category.create({
      name,
      description,
      owner: req.user._id
    });

    // Log activity
    await ActivityLog.create({
      action: 'Category Created',
      description: `Category "${category.name}" was created`,
      user: req.user._id,
      userName: req.user.name,
      resourceType: 'Category',
      resourceId: category._id
    });

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      category
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private
exports.updateCategory = async (req, res) => {
  try {
    let category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ 
        success: false, 
        message: 'Category not found' 
      });
    }

    // Authorization check
    if (category.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to update this category' 
      });
    }

    // Check if new name conflicts with existing category
    if (req.body.name && req.body.name !== category.name) {
      const existingCategory = await Category.findOne({ 
        name: req.body.name.trim(), 
        owner: req.user._id,
        _id: { $ne: req.params.id }
      });

      if (existingCategory) {
        return res.status(400).json({ 
          success: false, 
          message: 'Category with this name already exists' 
        });
      }
    }

    category = await Category.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      {
        new: true,
        runValidators: true
      }
    );

    // Log activity
    await ActivityLog.create({
      action: 'Category Updated',
      description: `Category "${category.name}" was updated`,
      user: req.user._id,
      userName: req.user.name,
      resourceType: 'Category',
      resourceId: category._id
    });

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      category
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private
exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ 
        success: false, 
        message: 'Category not found' 
      });
    }

    // Authorization check
    if (category.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to delete this category' 
      });
    }

    // Check if category has products
    const Product = require('../models/Product');
    const productsCount = await Product.countDocuments({ category: req.params.id });

    if (productsCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete category. It has ${productsCount} product(s) associated with it.` 
      });
    }

    await Category.deleteOne({ _id: req.params.id });

    // Log activity
    await ActivityLog.create({
      action: 'Category Deleted',
      description: `Category "${category.name}" was deleted`,
      user: req.user._id,
      userName: req.user.name,
      resourceType: 'Category',
      resourceId: category._id
    });

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
