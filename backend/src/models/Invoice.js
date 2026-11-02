const mongoose = require('mongoose');
const { INVOICE_STATUS } = require('../config/constants');

const lineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    rate: { type: Number, required: true, min: 0 },
    amount: Number,
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String, unique: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    lines: { type: [lineSchema], validate: (v) => v.length > 0 },
    subtotal: Number,
    discount: { type: Number, default: 0 },
    taxPercent: { type: Number, default: 0 },
    taxAmount: Number,
    grandTotal: Number,
    invoiceDate: { type: Date, default: Date.now },
    status: { type: String, enum: INVOICE_STATUS, default: 'generated' },
    remarks: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Invoice', invoiceSchema);
