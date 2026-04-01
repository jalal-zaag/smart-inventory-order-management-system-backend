const RestockQueue = require('../models/RestockQueue');
const Product = require('../models/Product');
const ActivityLog = require('../models/ActivityLog');
const { buildPaginatedResponse, parsePaginationParams } = require('../utils/paginationUtils');

// @desc    Get restock queue with pagination
// @route   GET /api/restock-queue
// @access  Private
exports.getRestockQueue = async (req, res) => {
  try {
    const { page, size, skip } = parsePaginationParams(req.query);
    
    // Admin sees all queue items, regular users see only their products
    let allQueueItems;
    if (req.user.role === 'admin') {
      allQueueItems = await RestockQueue.find()
        .populate({
          path: 'product',
          select: 'name stockQuantity minStockThreshold status category owner'
        })
        .sort({ priority: 1, currentStock: 1, addedAt: 1 });
    } else {
      allQueueItems = await RestockQueue.find()
        .populate({
          path: 'product',
          match: { owner: req.user._id },
          select: 'name stockQuantity minStockThreshold status category owner'
        })
        .sort({ priority: 1, currentStock: 1, addedAt: 1 });
    }

    // Filter out items where product is null (not owned by user for non-admin)
    const filteredQueue = allQueueItems.filter(item => item.product !== null);
    
    // Apply priority filter if provided
    let finalQueue = filteredQueue;
    if (req.query.priority) {
      finalQueue = filteredQueue.filter(item => item.priority === req.query.priority);
    }

    // Manual pagination
    const totalElements = finalQueue.length;
    const paginatedQueue = finalQueue.slice(skip, skip + size);

    // Transform data to match required format
    const content = paginatedQueue.map(item => ({
      id: item._id,
      createdAt: new Date(item.addedAt).getTime(),
      updatedAt: new Date(item.addedAt).getTime(),
      productId: item.product?._id,
      productName: item.product?.name,
      currentStock: item.currentStock,
      minStockThreshold: item.minStockThreshold,
      priority: item.priority,
      addedAt: new Date(item.addedAt).getTime(),
      createdBy: req.user ? { id: req.user._id, firstName: req.user.name, lastName: '' } : null,
      updatedBy: null
    }));

    const response = buildPaginatedResponse(content, page, size, totalElements);
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
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

    // Authorization check - admin can restock any product, users only their own
    if (req.user.role !== 'admin' && product.owner.toString() !== req.user._id.toString()) {
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

    // Authorization check - admin can modify any queue item, users only their own
    const product = await Product.findById(queueItem.product._id);
    if (product && req.user.role !== 'admin' && product.owner.toString() !== req.user._id.toString()) {
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
