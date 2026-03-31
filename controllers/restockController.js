const RestockQueue = require('../models/RestockQueue');
const Product = require('../models/Product');
const ActivityLog = require('../models/ActivityLog');

// @desc    Get restock queue
// @route   GET /api/restock-queue
// @access  Private
exports.getRestockQueue = async (req, res) => {
  try {
    const queue = await RestockQueue.find()
      .populate({
        path: 'product',
        match: { owner: req.user._id },
        select: 'name stockQuantity minStockThreshold status category'
      })
      .sort({ priority: 1, currentStock: 1, addedAt: 1 });

    // Filter out items where product is null (not owned by user)
    const filteredQueue = queue.filter(item => item.product !== null);

    res.status(200).json({
      success: true,
      count: filteredQueue.length,
      queue: filteredQueue
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Manually restock product (update stock)
// @route   POST /api/restock-queue/:id/restock
// @access  Private
exports.restockProduct = async (req, res) => {
  try {
    const { quantity } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide a valid quantity to restock' 
      });
    }

    const queueItem = await RestockQueue.findById(req.params.id).populate('product');

    if (!queueItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Restock queue item not found' 
      });
    }

    const product = await Product.findById(queueItem.product._id);

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
        message: 'Not authorized to restock this product' 
      });
    }

    const oldStock = product.stockQuantity;
    product.stockQuantity += quantity;
    await product.save();

    // Remove from restock queue if stock is now sufficient
    if (product.stockQuantity >= product.minStockThreshold) {
      await RestockQueue.deleteOne({ _id: req.params.id });
    } else {
      // Update queue item with new stock level
      queueItem.currentStock = product.stockQuantity;
      await queueItem.save();
    }

    // Log activity
    await ActivityLog.create({
      action: 'Product Restocked',
      description: `Product "${product.name}" restocked: ${oldStock} → ${product.stockQuantity} (+${quantity})`,
      user: req.user._id,
      userName: req.user.name,
      resourceType: 'Product',
      resourceId: product._id,
      metadata: { oldStock, newStock: product.stockQuantity, addedQuantity: quantity }
    });

    res.status(200).json({
      success: true,
      message: `Product restocked successfully. New stock: ${product.stockQuantity}`,
      product
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Remove item from restock queue (manual removal)
// @route   DELETE /api/restock-queue/:id
// @access  Private
exports.removeFromQueue = async (req, res) => {
  try {
    const queueItem = await RestockQueue.findById(req.params.id).populate('product');

    if (!queueItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Restock queue item not found' 
      });
    }

    // Authorization check
    const product = await Product.findById(queueItem.product._id);
    if (product && product.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to modify this queue item' 
      });
    }

    await RestockQueue.deleteOne({ _id: req.params.id });

    res.status(200).json({
      success: true,
      message: 'Item removed from restock queue'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
