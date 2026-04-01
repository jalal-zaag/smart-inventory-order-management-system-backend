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

    // Admin sees all data, regular users see only their own
    const ownerFilter = req.user.role === 'admin' ? {} : { owner: req.user._id };

    // Total orders today
    const ordersToday = await Order.countDocuments({
      ...ownerFilter,
      createdAt: { $gte: today, $lt: tomorrow }
    });

    // Pending orders
    const pendingOrders = await Order.countDocuments({
      ...ownerFilter,
      status: 'Pending'
    });

    // Completed orders (Delivered)
    const completedOrders = await Order.countDocuments({
      ...ownerFilter,
      status: 'Delivered'
    });

    // Revenue today
    const revenueMatch = req.user.role === 'admin' 
      ? { createdAt: { $gte: today, $lt: tomorrow }, status: { $ne: 'Cancelled' } }
      : { owner: req.user._id, createdAt: { $gte: today, $lt: tomorrow }, status: { $ne: 'Cancelled' } };

    const revenueResult = await Order.aggregate([
      { $match: revenueMatch },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } }
    ]);

    const revenueToday = revenueResult.length > 0 ? revenueResult[0].total : 0;

    // Low stock items count
    const lowStockQuery = req.user.role === 'admin' 
      ? { $expr: { $lt: ['$stockQuantity', '$minStockThreshold'] } }
      : { owner: req.user._id, $expr: { $lt: ['$stockQuantity', '$minStockThreshold'] } };

    const lowStockProducts = await Product.find(lowStockQuery);
    const lowStockCount = lowStockProducts.length;

    // Product summary (top 10 products with stock info)
    const products = await Product.find(ownerFilter)
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

    // Admin sees all activities, regular users only their own
    const query = req.user.role === 'admin' ? {} : { user: req.user._id };

    const activities = await ActivityLog.find(query)
      .sort('-createdAt')
      .limit(limit)
      .select('action description createdAt resourceType metadata userName');

    res.status(200).json({
      success: true,
      count: activities.length,
      activities
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get chart data for orders and revenue (last 7 days)
// @route   GET /api/dashboard/chart-data
// @access  Private
exports.getChartData = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    // Admin sees all data, regular users only their own
    const matchQuery = req.user.role === 'admin'
      ? { createdAt: { $gte: startDate, $lte: endDate } }
      : { owner: req.user._id, createdAt: { $gte: startDate, $lte: endDate } };

    // Aggregate orders by day
    const ordersByDay = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          totalOrders: { $sum: 1 },
          totalRevenue: {
            $sum: {
              $cond: [{ $ne: ['$status', 'Cancelled'] }, '$totalPrice', 0]
            }
          },
          completedOrders: {
            $sum: {
              $cond: [{ $eq: ['$status', 'Delivered'] }, 1, 0]
            }
          },
          cancelledOrders: {
            $sum: {
              $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0]
            }
          }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    // Generate all dates in range and fill with data
    const chartData = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const day = currentDate.getDate();
      
      const dayData = ordersByDay.find(
        d => d._id.year === year && d._id.month === month && d._id.day === day
      );

      chartData.push({
        date: currentDate.toISOString().split('T')[0],
        displayDate: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        orders: dayData?.totalOrders || 0,
        revenue: dayData?.totalRevenue || 0,
        completed: dayData?.completedOrders || 0,
        cancelled: dayData?.cancelledOrders || 0
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Calculate summary
    const summary = {
      totalOrders: chartData.reduce((sum, d) => sum + d.orders, 0),
      totalRevenue: chartData.reduce((sum, d) => sum + d.revenue, 0),
      avgOrdersPerDay: (chartData.reduce((sum, d) => sum + d.orders, 0) / days).toFixed(1),
      avgRevenuePerDay: (chartData.reduce((sum, d) => sum + d.revenue, 0) / days).toFixed(2)
    };

    res.status(200).json({
      success: true,
      days,
      chartData,
      summary
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
