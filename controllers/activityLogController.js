const ActivityLog = require('../models/ActivityLog');
const { buildPaginatedResponse, parsePaginationParams } = require('../utils/paginationUtils');

// @desc    Get all activity logs with pagination and filters
// @route   GET /api/activity-logs
// @access  Private
exports.getActivityLogs = async (req, res) => {
  try {
    const { page, size, skip } = parsePaginationParams(req.query);
    
    // Admin sees all activities, regular users see only their own
    const query = req.user.role === 'admin' ? {} : { user: req.user._id };

    // Search filter (action or description)
    if (req.query.search) {
      query.$or = [
        { action: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Resource type filter
    if (req.query.resourceType && req.query.resourceType !== 'all') {
      query.resourceType = req.query.resourceType;
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
    const totalElements = await ActivityLog.countDocuments(query);

    // Get paginated data
    const activities = await ActivityLog.find(query)
      .sort('-createdAt')
      .skip(skip)
      .limit(size);

    // Transform data to match required format
    const content = activities.map(activity => ({
      id: activity._id,
      createdAt: new Date(activity.createdAt).getTime(),
      action: activity.action,
      description: activity.description,
      resourceType: activity.resourceType,
      resourceId: activity.resourceId,
      userName: activity.userName,
      userId: activity.user,
      metadata: activity.metadata
    }));

    const response = buildPaginatedResponse(content, page, size, totalElements);
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single activity log
// @route   GET /api/activity-logs/:id
// @access  Private
exports.getActivityLog = async (req, res) => {
  try {
    const activity = await ActivityLog.findById(req.params.id);

    if (!activity) {
      return res.status(404).json({ 
        success: false, 
        message: 'Activity log not found' 
      });
    }

    // Admin can access any activity, regular users only their own
    if (req.user.role !== 'admin' && activity.user?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to access this activity log' 
      });
    }

    res.status(200).json({
      success: true,
      activity
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
