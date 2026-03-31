const Order = require('../models/Order');
const Product = require('../models/Product');
const ActivityLog = require('../models/ActivityLog');

// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private
exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Total orders today
    const ordersToday = await Order.countDocuments({
      owner: req.user._id,
      createdAt: { $gte: today, $lt: tomorrow }
    });

    // Pending orders
    const pendingOrders = await Order.countDocuments({
      owner: req.user._id,
      status: 'Pending'
    });

    // Completed orders (Delivered)
    const completedOrders = await Order.countDocuments({
      owner: req.user._id,
      status: 'Delivered'
    });

    // Revenue today
    const revenueResult = await Order.aggregate([
      {
        $match: {
          owner: req.user._id,
          createdAt: { $gte: today, $lt: tomorrow },
          status: { $ne: 'Cancelled' }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalPrice' }
        }
      }
    ]);

    const revenueToday = revenueResult.length > 0 ? revenueResult[0].total : 0;

    // Low stock items count
    const lowStockProducts = await Product.find({
      owner: req.user._id,
      $expr: { $lt: ['$stockQuantity', '$minStockThreshold'] }
    });

    const lowStockCount = lowStockProducts.length;

    // Product summary (top 5 products with stock info)
    const products = await Product.find({ owner: req.user._id })
      .select('name stockQuantity minStockThreshold status')
      .sort('-createdAt')
      .limit(10);

    const productSummary = products.map(p => ({
      name: p.name,
      stock: p.stockQuantity,
      threshold: p.minStockThreshold,
      status: p.stockQuantity < p.minStockThreshold ? 'Low Stock' : 
              p.stockQuantity === 0 ? 'Out of Stock' : 'OK'
    }));

    res.status(200).json({
      success: true,
      stats: {
        ordersToday,
        pendingOrders,
        completedOrders,
        revenueToday,
        lowStockCount,
        productSummary
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get recent activities
// @route   GET /api/dashboard/activities
// @access  Private
exports.getRecentActivities = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const activities = await ActivityLog.find({ user: req.user._id })
      .sort('-createdAt')
      .limit(limit)
      .select('action description createdAt resourceType metadata');

    res.status(200).json({
      success: true,
      count: activities.length,
      activities
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
