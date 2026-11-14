/**
 * npm run migrate:v34   (safe to run more than once)
 * v3.4 changes the data in two small ways:
 *  1. Customers now have an owner (createdBy). Customers that were created together with an order by an agent are
 *     handed to that agent, so each agent keeps seeing their own customers. Customers the admin added stay with the admin.
 *  2. Order numbers continue as HBD-00001... The old ORD-... orders keep their numbers (nothing is renamed).
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { mongoUri } = require('../config/env');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const User = require('../models/User');

(async () => {
  await mongoose.connect(mongoUri);
  const agents = await User.find({ role: 'agent' }).select('_id');
  const agentIds = new Set(agents.map((a) => String(a._id)));
  const orders = await Order.find({ createdBy: { $exists: true } }).select('customer createdBy orderDate').sort({ orderDate: 1 }).lean();
  const owner = new Map();
  for (const o of orders) {
    if (o.customer && agentIds.has(String(o.createdBy)) && !owner.has(String(o.customer))) owner.set(String(o.customer), o.createdBy);
  }
  let updated = 0;
  for (const [customerId, agentId] of owner) {
    const r = await Customer.updateOne({ _id: customerId, createdBy: { $exists: false } }, { $set: { createdBy: agentId } });
    updated += r.modifiedCount;
  }
  await Customer.syncIndexes();
  await Order.syncIndexes();
  console.log(`Done. ${updated} customer(s) assigned to the agent who created them.`);
  await mongoose.disconnect();
})().catch((err) => { console.error(err); process.exit(1); });
