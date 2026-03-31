const mongoose = require('mongoose');

const restockQueueSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    unique: true
  },
  productName: {
    type: String,
    required: true
  },
  currentStock: {
    type: Number,
    required: true,
    default: 0
  },
  minStockThreshold: {
    type: Number,
    required: true
  },
  priority: {
    type: String,
    enum: ['High', 'Medium', 'Low'],
    default: 'Medium'
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

// Calculate priority based on stock deficit
restockQueueSchema.pre('save', function() {
  const deficit = this.minStockThreshold - this.currentStock;
  
  if (this.currentStock === 0) {
    this.priority = 'High';
  } else if (deficit >= this.minStockThreshold * 0.5) {
    this.priority = 'High';
  } else if (deficit >= this.minStockThreshold * 0.25) {
    this.priority = 'Medium';
  } else {
    this.priority = 'Low';
  }
});

module.exports = mongoose.model('RestockQueue', restockQueueSchema);
