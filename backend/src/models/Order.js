const mongoose = require('mongoose');
const { ORDER_STATUS, MAX_AGENT_CHANGES } = require('../config/constants');

const itemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: String,
    sku: String,
    price: { type: Number, required: true }, // unit price (GST included for orders with taxInclusive; older orders: without GST)
    quantity: { type: Number, required: true, min: 1 },
    discount: { type: Number, default: 0, min: 0 }, // flat amount off this line (INR, not a percentage)
    gstAmount: { type: Number, default: 0 }, // GST contained in this line (older orders: GST added on top)
    lineTotal: { type: Number, default: 0 }, // amount payable for the line
  },
  { _id: false }
);

// Filled automatically when the shipment is booked / synced. Not edited by hand.
const courierSchema = new mongoose.Schema(
  {
    partner: String,
    awb: String,
    dispatchDate: Date,
    deliveryStatus: { type: String, default: 'pending' },
  },
  { _id: false }
);

const historySchema = new mongoose.Schema(
  {
    status: String,
    note: String,
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    auto: { type: Boolean, default: false }, // true = written by the live courier sync
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const trackEventSchema = new mongoose.Schema({ message: String, location: String, time: String }, { _id: false });

// Shipment data for Xpressbees / Shipmozo / Ekart (booking -> courier -> AWB)
const shippingSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['not_pushed', 'booked', 'cancelled'],
      default: 'not_pushed',
    },
    provider: { type: String, enum: ['xpressbees', 'shipmozo', 'ekart', 'delhivery', 'shiprocket'] }, // which courier platform holds this booking
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
    mode: { type: String, enum: ['surface', 'air'] }, // transport of the chosen courier service
    awb: String,
    xbOrderId: String, // the courier platform's own order id (Xpressbees / Shiprocket)
    shipmentId: String,
    labelUrl: String,
    manifestUrl: String,
    manifestedAt: Date, // pickup manifest generated (or pickup auto-scheduled by the courier) -> "Ready to pickup"
    lastTrackStatus: String, // courier's own wording, e.g. "Out For Delivery"
    lastTrackedAt: Date,
    trackHistory: [trackEventSchema], // latest scans, newest first
    ndr: { type: mongoose.Schema.Types.Mixed },
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
    subtotal: Number, // before discount and GST
    discountTotal: { type: Number, default: 0 }, // flat discount, total of all lines
    gstRate: { type: Number, default: 5 },
    gstAmount: { type: Number, default: 0 }, // GST contained in the total (or added on top for taxInclusive = false)
    taxableAmount: { type: Number, default: 0 }, // total without GST
    taxInclusive: { type: Boolean, default: false }, // true = prices include GST (every order from v3.4 on)
    gstNumber: { type: String, trim: true, uppercase: true }, // GSTIN of the buyer, optional, printed on the label
    totalAmount: { type: Number, default: 0 }, // payable amount
    orderDate: { type: Date, default: Date.now },
    status: { type: String, enum: ORDER_STATUS, default: 'new_order', index: true },
    statusHistory: [historySchema],
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    agentChanges: { type: Number, default: 0 }, // how many times the agent was changed after the first assignment
    // Chosen while creating the order; the shipping panel starts from these values
    payment: {
      type: { type: String, enum: ['PREPAID', 'COD'], default: 'PREPAID' },
      codAmount: { type: Number, default: 0 },
    },
    parcel: { weight: Number, length: Number, width: Number, height: Number }, // grams / cm
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
    courier: { type: courierSchema, default: () => ({}) },
    shipping: { type: shippingSchema, default: () => ({}) },
    notes: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    confirmedAt: Date,
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

orderSchema.virtual('agentChangesLeft').get(function left() {
  return Math.max(MAX_AGENT_CHANGES - (this.agentChanges || 0), 0);
});
orderSchema.virtual('agentLocked').get(function locked() {
  return Boolean(this.agent) && (this.agentChanges || 0) >= MAX_AGENT_CHANGES;
});
orderSchema.index({ 'shipping.awb': 1 });
orderSchema.index({ 'courier.awb': 1 });
orderSchema.index({ status: 1, orderDate: -1 });
orderSchema.index({ orderDate: -1 });
orderSchema.index({ customer: 1 });
orderSchema.index({ 'shipping.provider': 1, status: 1 });
orderSchema.index({ agent: 1, status: 1, orderDate: -1 });

module.exports = mongoose.model('Order', orderSchema);
