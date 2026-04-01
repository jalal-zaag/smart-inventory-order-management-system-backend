const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { buildPaginatedResponse, parsePaginationParams } = require('../utils/paginationUtils');

// @desc    Get all customers (registered users) with pagination and search (Admin only)
// @route   GET /api/customers
// @access  Private (Admin only)
exports.getCustomers = async (req, res) => {
  try {
    const { page, size, skip } = parsePaginationParams(req.query);
    
    // Build query object - show all users
    const query = {};

    // Filter by role if provided
    if (req.query.role) {
      query.role = req.query.role;
    }

    // Search filter - search across name and email
    if (req.query.search) {
      const searchRegex = { $regex: req.query.search, $options: 'i' };
      query.$or = [
        { name: searchRegex },
        { email: searchRegex }
      ];
    }

    // Get total count
    const totalElements = await User.countDocuments(query);

    // Get paginated data (excluding password field)
    const users = await User.find(query)
      .select('-password')
      .sort('-createdAt')
      .skip(skip)
      .limit(size);

    // Transform data to match required format
    const content = users.map(user => ({
      id: user._id,
      createdAt: new Date(user.createdAt).getTime(),
      updatedAt: user.updatedAt ? new Date(user.updatedAt).getTime() : new Date(user.createdAt).getTime(),
      name: user.name,
      email: user.email,
      role: user.role,
      active: true,
      createdBy: { 
        id: user._id, 
        firstName: user.name, 
        lastName: ''
      },
      updatedBy: null
    }));

    const response = buildPaginatedResponse(content, page, size, totalElements);
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single customer (registered user) (Admin only)
// @route   GET /api/customers/:id
// @access  Private (Admin only)
exports.getCustomer = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.status(200).json({
      success: true,
      customer: user
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update customer (registered user) role or info (Admin only)
// @route   PUT /api/customers/:id
// @access  Private (Admin only)
exports.updateCustomer = async (req, res) => {
  try {
    let user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Prevent updating password through this route
    if (req.body.password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password cannot be updated through this endpoint' 
      });
    }

    // Check if new email conflicts with existing user
    if (req.body.email && req.body.email.toLowerCase() !== user.email.toLowerCase()) {
      const existingUser = await User.findOne({ 
        email: req.body.email.trim().toLowerCase(), 
        _id: { $ne: req.params.id } 
      });

      if (existingUser) {
        return res.status(400).json({ 
          success: false, 
          message: 'User with this email already exists' 
        });
      }
    }

    // Update allowed fields only
    const allowedUpdates = ['name', 'email', 'role'];
    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    user = await User.findByIdAndUpdate(
      req.params.id, 
      updates, 
      {
        new: true,
        runValidators: true
      }
    ).select('-password');

    // Log activity
    await ActivityLog.create({
      action: 'User Updated',
      description: `User "${user.name}" was updated by admin`,
      user: req.user._id,
      userName: req.user.name,
      resourceType: 'User',
      resourceId: user._id
    });

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      customer: user
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete customer (registered user) (Admin only)
// @route   DELETE /api/customers/:id
// @access  Private (Admin only)
exports.deleteCustomer = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Prevent admin from deleting themselves
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ 
        success: false, 
        message: 'You cannot delete your own account' 
      });
    }

    // Check if user has associated data (orders, categories, products, etc.)
    const Category = require('../models/Category');
    const Product = require('../models/Product');
    const Order = require('../models/Order');

    const categoriesCount = await Category.countDocuments({ owner: req.params.id });
    const productsCount = await Product.countDocuments({ owner: req.params.id });
    const ordersCount = await Order.countDocuments({ user: req.params.id });

    if (categoriesCount > 0 || productsCount > 0 || ordersCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete user. They have associated data: ${categoriesCount} categories, ${productsCount} products, ${ordersCount} orders.` 
      });
    }

    await User.deleteOne({ _id: req.params.id });

    // Log activity
    await ActivityLog.create({
      action: 'User Deleted',
      description: `User "${user.name}" (${user.email}) was deleted by admin`,
      user: req.user._id,
      userName: req.user.name,
      resourceType: 'User',
      resourceId: user._id
    });

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
