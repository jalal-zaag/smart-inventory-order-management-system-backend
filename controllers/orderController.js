const Order = require('../models/Order');
const Product = require('../models/Product');
const RestockQueue = require('../models/RestockQueue');
const ActivityLog = require('../models/ActivityLog');
const { buildPaginatedResponse, parsePaginationParams } = require('../utils/paginationUtils');

// @desc    Get all orders with pagination, search and filters
// @route   GET /api/orders
// @access  Private
exports.getOrders = async (req, res) => {
  try {
    const { page, size, skip } = parsePaginationParams(req.query);
    
    // Admin sees all orders, regular users see only their own
    const query = req.user.role === 'admin' ? {} : { owner: req.user._id };

    // Search filter (order number or customer name)
    if (req.query.search) {
      query.$or = [
        { orderNumber: { $regex: req.query.search, $options: 'i' } },
        { customerName: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Status filter
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Date range filter
    if (req.query.from || req.query.to) {
      query.createdAt = {};
      if (req.query.from) {
        query.createdAt.$gte = new Date(parseInt(req.query.from));
      }
      if (req.query.to) {
        query.createdAt.$lte = new Date(parseInt(req.query.to));
      }
    }

    // Get total count
    const totalElements = await Order.countDocuments(query);

    // Get paginated data
    const orders = await Order.find(query)
      .populate('items.product')
      .sort('-createdAt')
      .skip(skip)
      .limit(size);

    // Transform data to match required format
    const content = orders.map(order => ({
      id: order._id,
      createdAt: new Date(order.createdAt).getTime(),
      updatedAt: new Date(order.updatedAt).getTime(),
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      status: order.status,
      totalPrice: order.totalPrice,
      items: order.items.map(item => ({
        productId: item.product?._id,
        productName: item.product?.name || item.productName,
        quantity: item.quantity,
        price: item.price
      })),
      createdBy: req.user ? { id: req.user._id, firstName: req.user.name, lastName: '' } : null,
      updatedBy: null
    }));

    const response = buildPaginatedResponse(content, page, size, totalElements);
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.product');

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    // Admin can access any order, regular users only their own
    if (req.user.role !== 'admin' && order.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to access this order' 
      });
    }

    res.status(200).json({
      success: true,
      order
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
exports.createOrder = async (req, res) => {
  try {
    const { customerName, items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Order must contain at least one item' 
      });
    }

    // Validate items and check for duplicates
    const productIds = items.map(item => item.product.toString());
    const uniqueProductIds = new Set(productIds);
    
    if (productIds.length !== uniqueProductIds.size) {
      return res.status(400).json({ 
        success: false, 
        message: 'Duplicate products found in order. Each product can only be added once.' 
      });
    }

    // Validate stock availability and product status
    const orderItems = [];
    let totalPrice = 0;
    const stockUpdates = [];

    for (const item of items) {
      const product = await Product.findById(item.product);
      
      if (!product) {
        return res.status(404).json({ 
          success: false, 
          message: `Product not found: ${item.product}` 
        });
      }

      // Check if product is active
      if (product.status !== 'Active') {
        return res.status(400).json({ 
          success: false, 
          message: `Product "${product.name}" is currently unavailable (${product.status})` 
        });
      }

      // Check stock availability
      if (product.stockQuantity < item.quantity) {
        return res.status(400).json({ 
          success: false, 
          message: `Insufficient stock for "${product.name}". Only ${product.stockQuantity} items available in stock.` 
        });
      }

      // Prepare order item
      const subtotal = product.price * item.quantity;
      orderItems.push({
        product: product._id,
        productName: product.name,
        quantity: item.quantity,
        price: product.price,
        subtotal
      });

      totalPrice += subtotal;

      // Prepare stock update
      stockUpdates.push({
        productId: product._id,
        productName: product.name,
        newStock: product.stockQuantity - item.quantity,
        minThreshold: product.minStockThreshold
      });
    }

    // Create order
    const order = await Order.create({
      customerName,
      items: orderItems,
      totalPrice,
      owner: req.user._id
    });

    // Update stock for all products
    for (const update of stockUpdates) {
      const product = await Product.findByIdAndUpdate(
        update.productId,
        { stockQuantity: update.newStock },
        { new: true }
      );

      // Add to restock queue if below threshold
      if (update.newStock < update.minThreshold) {
        await RestockQueue.findOneAndUpdate(
          { product: update.productId },
          {
            product: update.productId,
            productName: update.productName,
            currentStock: update.newStock,
            minStockThreshold: update.minThreshold
          },
          { upsert: true, new: true }
        );
      }
    }

    // Log activity
    await ActivityLog.create({
      action: 'Order Created',
      description: `Order ${order.orderNumber} created for ${customerName} with ${items.length} item(s)`,
      user: req.user._id,
      userName: req.user.name,
      resourceType: 'Order',
      resourceId: order._id,
      metadata: { orderNumber: order.orderNumber, totalPrice }
    });

    const populatedOrder = await Order.findById(order._id).populate('items.product');

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: populatedOrder
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id
// @access  Private
exports.updateOrder = async (req, res) => {
  try {
    let order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    // Admin can update any order, regular users only their own
    if (req.user.role !== 'admin' && order.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to update this order' 
      });
    }

    // Prevent updating cancelled orders
    if (order.status === 'Cancelled') {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot update a cancelled order' 
      });
    }

    const oldStatus = order.status;
    
    order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status || order.status },
      { new: true, runValidators: true }
    ).populate('items.product');

    // Log activity if status changed
    if (oldStatus !== order.status) {
      await ActivityLog.create({
        action: 'Order Status Updated',
        description: `Order ${order.orderNumber} status changed from ${oldStatus} to ${order.status}`,
        user: req.user._id,
        userName: req.user.name,
        resourceType: 'Order',
        resourceId: order._id,
        metadata: { orderNumber: order.orderNumber, oldStatus, newStatus: order.status }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Order updated successfully',
      order
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Cancel order
// @route   POST /api/orders/:id/cancel
// @access  Private
exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    // Admin can cancel any order, regular users only their own
    if (req.user.role !== 'admin' && order.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to cancel this order' 
      });
    }

    // Check if already cancelled
    if (order.status === 'Cancelled') {
      return res.status(400).json({ 
        success: false, 
        message: 'Order is already cancelled' 
      });
    }

    // Check if order can be cancelled (only Pending and Confirmed)
    if (!['Pending', 'Confirmed'].includes(order.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot cancel order with status: ${order.status}` 
      });
    }

    // Restore stock for all items
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (product) {
        product.stockQuantity += item.quantity;
        await product.save();

        // Update or remove from restock queue
        if (product.stockQuantity >= product.minStockThreshold) {
          await RestockQueue.deleteOne({ product: product._id });
        } else {
          await RestockQueue.findOneAndUpdate(
            { product: product._id },
            { currentStock: product.stockQuantity },
            { new: true }
          );
        }
      }
    }

    order.status = 'Cancelled';
    await order.save();

    // Log activity
    await ActivityLog.create({
      action: 'Order Cancelled',
      description: `Order ${order.orderNumber} was cancelled and stock was restored`,
      user: req.user._id,
      userName: req.user.name,
      resourceType: 'Order',
      resourceId: order._id,
      metadata: { orderNumber: order.orderNumber }
    });

    const populatedOrder = await Order.findById(order._id).populate('items.product');

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully and stock restored',
      order: populatedOrder
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete order
// @route   DELETE /api/orders/:id
// @access  Private
exports.deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    // Admin can delete any order, regular users only their own
    if (req.user.role !== 'admin' && order.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to delete this order' 
      });
    }

    await Order.deleteOne({ _id: req.params.id });

    // Log activity
    await ActivityLog.create({
      action: 'Order Deleted',
      description: `Order ${order.orderNumber} was deleted`,
      user: req.user._id,
      userName: req.user.name,
      resourceType: 'Order',
      resourceId: order._id
    });

    res.status(200).json({
      success: true,
      message: 'Order deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
