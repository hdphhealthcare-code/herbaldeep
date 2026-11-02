const mongoose = require('mongoose');
const { ORDER_STATUS } = require('../config/constants');

const itemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: String,
    sku: String,
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const courierSchema = new mongoose.Schema(
  {
    partner: String,
    awb: String,
    dispatchDate: Date,
    dispatchStatus: { type: String, default: 'pending' },
    deliveryStatus: { type: String, default: 'pending' },
    remarks: String,
  },
  { _id: false }
);

const historySchema = new mongoose.Schema(
  {
    status: String,
    note: String,
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

// Shipment data for Xpressbees / Shipmozo / Ekart (booking -> courier -> AWB)
const shippingSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['not_pushed', 'booked', 'cancelled'],
      default: 'not_pushed',
    },
    provider: { type: String, enum: ['xpressbees', 'shipmozo', 'ekart'] }, // which courier platform holds this booking
    providerOrderId: String, // order id sent to the provider (changes after a cancel + rebook)
    attempts: { type: Number, default: 0 }, // number of cancelled bookings so far
    lrNumber: String,
    warehouseId: String, // local Warehouse _id
    weight: Number, // grams
    length: Number,
    width: Number,
    height: Number,
    paymentType: { type: String, enum: ['PREPAID', 'COD'], default: 'PREPAID' },
    codAmount: Number,
    courierId: String,
    courierName: String,
    awb: String,
    xbOrderId: String,
    shipmentId: String,
    labelUrl: String,
    manifestUrl: String,
    lastTrackStatus: String,
    lastTrackedAt: Date,
    returnAwb: String,
    returnPushed: { type: Boolean, default: false },
    pushedAt: Date,
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, unique: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    totalAmount: { type: Number, default: 0 },
    orderDate: { type: Date, default: Date.now },
    status: { type: String, enum: ORDER_STATUS, default: 'new_order', index: true },
    statusHistory: [historySchema],
    zone: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone' },
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    courier: { type: courierSchema, default: () => ({}) },
    shipping: { type: shippingSchema, default: () => ({}) },
    notes: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
