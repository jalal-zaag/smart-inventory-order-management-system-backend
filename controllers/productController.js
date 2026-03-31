const Product = require('../models/Product');
const Category = require('../models/Category');
const RestockQueue = require('../models/RestockQueue');
const ActivityLog = require('../models/ActivityLog');

// @desc    Get all products
// @route   GET /api/products
// @access  Private
exports.getProducts = async (req, res) => {
  try {
    const query = { owner: req.user._id };

    // Dynamic filtering
    if (req.query.category) query.category = req.query.category;
    if (req.query.status) query.status = req.query.status;
    if (req.query.search) {
      query.name = { $regex: req.query.search, $options: 'i' };
    }

    const products = await Product.find(query)
      .populate('category')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Private
exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('category');

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    // Authorization check
    if (product.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to access this product' 
      });
    }

    res.status(200).json({
      success: true,
      product
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private
exports.createProduct = async (req, res) => {
  try {
    const { name, category, price, stockQuantity, minStockThreshold } = req.body;

    // Validate category exists
    const categoryDoc = await Category.findById(category);
    if (!categoryDoc) {
      return res.status(404).json({ 
        success: false, 
        message: 'Category not found' 
      });
    }

    // Authorization check for category
    if (categoryDoc.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to use this category' 
      });
    }

    const product = await Product.create({
      name,
      category,
      categoryName: categoryDoc.name,
      price,
      stockQuantity: stockQuantity || 0,
      minStockThreshold: minStockThreshold || 5,
      owner: req.user._id
    });

    await product.populate('category');

    // Check if product needs to be added to restock queue
    if (product.stockQuantity < product.minStockThreshold) {
      await RestockQueue.findOneAndUpdate(
        { product: product._id },
        {
          product: product._id,
          productName: product.name,
          currentStock: product.stockQuantity,
          minStockThreshold: product.minStockThreshold
        },
        { upsert: true, new: true }
      );
    }

    // Log activity
    await ActivityLog.create({
      action: 'Product Created',
      description: `Product "${product.name}" was created with ${product.stockQuantity} units`,
      user: req.user._id,
      userName: req.user.name,
      resourceType: 'Product',
      resourceId: product._id
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private
exports.updateProduct = async (req, res) => {
  try {
    let product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    // Authorization check
    if (product.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to update this product' 
      });
    }

    // If category is being changed, validate new category
    if (req.body.category && req.body.category !== product.category.toString()) {
      const categoryDoc = await Category.findById(req.body.category);
      if (!categoryDoc || categoryDoc.owner.toString() !== req.user._id.toString()) {
        return res.status(403).json({ 
          success: false, 
          message: 'Not authorized to use this category' 
        });
      }
      req.body.categoryName = categoryDoc.name;
    }

    const oldStock = product.stockQuantity;
    
    product = await Product.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      {
        new: true,
        runValidators: true
      }
    ).populate('category');

    // Manage restock queue
    if (product.stockQuantity < product.minStockThreshold) {
      await RestockQueue.findOneAndUpdate(
        { product: product._id },
        {
          product: product._id,
          productName: product.name,
          currentStock: product.stockQuantity,
          minStockThreshold: product.minStockThreshold
        },
        { upsert: true, new: true }
      );
    } else {
      // Remove from restock queue if stock is now sufficient
      await RestockQueue.deleteOne({ product: product._id });
    }

    // Log activity
    let activityDescription = `Product "${product.name}" was updated`;
    if (req.body.stockQuantity !== undefined && oldStock !== product.stockQuantity) {
      activityDescription = `Product "${product.name}" stock updated from ${oldStock} to ${product.stockQuantity}`;
    }

    await ActivityLog.create({
      action: 'Product Updated',
      description: activityDescription,
      user: req.user._id,
      userName: req.user.name,
      resourceType: 'Product',
      resourceId: product._id
    });

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    // Authorization check
    if (product.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to delete this product' 
      });
    }

    await Product.deleteOne({ _id: req.params.id });

    // Remove from restock queue if exists
    await RestockQueue.deleteOne({ product: req.params.id });

    // Log activity
    await ActivityLog.create({
      action: 'Product Deleted',
      description: `Product "${product.name}" was deleted`,
      user: req.user._id,
      userName: req.user.name,
      resourceType: 'Product',
      resourceId: product._id
    });

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
