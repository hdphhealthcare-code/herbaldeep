/**
 * v3.7: orders that are already shipped keep the customer details they were shipped with.
 * Copies the current customer details onto every booked order that has no snapshot yet.
 * Run once:  npm run migrate:v37   (safe to run again; it only touches orders without a snapshot)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const { snapshotOf } = require('../utils/customerSnapshot');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const orders = await Order.find({ 'shipping.status': 'booked', customerSnapshot: { $exists: false } }).select('customer');
  let done = 0;
  for (const o of orders) {
    const c = await Customer.findById(o.customer);
    if (!c) continue;
    await Order.updateOne({ _id: o._id }, { $set: { customerSnapshot: snapshotOf(c) } });
    done += 1;
  }
  console.log(`Customer details frozen on ${done} shipped order(s)`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
