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

    // Aggregate orders by day
    const ordersByDay = await Order.aggregate([
      {
        $match: {
          owner: req.user._id,
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
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
