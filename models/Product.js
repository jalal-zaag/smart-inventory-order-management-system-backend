const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Product must belong to a category']
  },
  categoryName: {
    type: String,
    default: ''
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  stockQuantity: {
    type: Number,
    required: [true, 'Stock quantity is required'],
    default: 0,
    min: [0, 'Stock quantity cannot be negative']
  },
  minStockThreshold: {
    type: Number,
    default: 5,
    min: [0, 'Minimum stock threshold cannot be negative']
  },
  status: {
    type: String,
    enum: ['Active', 'Out of Stock'],
    default: 'Active'
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save hook to update timestamp and status
productSchema.pre('save', function() {
  this.updatedAt = Date.now();
  
  // Auto-update status based on stock
  if (this.stockQuantity === 0) {
    this.status = 'Out of Stock';
  } else if (this.status === 'Out of Stock' && this.stockQuantity > 0) {
    this.status = 'Active';
  }
});

module.exports = mongoose.model('Product', productSchema);
