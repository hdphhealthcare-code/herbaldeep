const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    type: { type: String, enum: ['in', 'out', 'adjustment', 'return'], required: true },
    quantity: { type: Number, required: true }, // signed change applied to stock
    balance: { type: Number, required: true }, // stock after change
    reason: String,
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StockMovement', stockMovementSchema);
