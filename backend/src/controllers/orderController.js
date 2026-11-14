const Order = require('../models/Order');
const Customer = require('../models/Customer');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { parseListQuery, paginated } = require('../utils/pagination');
const { scopeFor } = require('../utils/orderScope');
const service = require('../services/orderService');

const POPULATE = [
  { path: 'customer' },
  { path: 'agent', select: 'name mobile' },
  { path: 'warehouse', select: 'title city pincode' },
  { path: 'statusHistory.by', select: 'name' },
];

const loadOrder = async (req) => {
  const order = await Order.findOne({ _id: req.params.id, ...scopeFor(req.user) });
  if (!order) throw new ApiError(404, 'Order not found');
  return order;
};

const respond = async (res, order, status = 200) => {
  await order.populate(POPULATE);
  res.status(status).json(order);
};

// Tabs of the order list (same buckets as the Xpressbees panel)
//  pending         = created, waiting for confirmation       confirmed       = confirmed, waiting for an admin to ship it
//  ready_to_ship   = booked, pickup manifest not made yet    ready_to_pickup = manifest made / pickup scheduled
const STAGES = {
  pending: { status: { $in: ['new_order', 'agent_assigned'] } },
  confirmed: { status: 'confirmed' },
  ready_to_ship: { status: 'ready_for_dispatch', 'shipping.manifestedAt': { $in: [null] } },
  ready_to_pickup: { status: 'ready_for_dispatch', 'shipping.manifestedAt': { $ne: null } },
  in_transit: { status: { $in: ['in_transit', 'out_for_delivery'] } },
  ndr: { status: 'ndr' },
  delivered: { status: { $in: ['delivered', 'invoice_generated'] } },
  rto: { status: { $in: ['rto', 'rto_delivered'] } },
  cancelled: { status: 'cancelled' },
};

const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const digits = (s) => String(s || '').replace(/\D/g, '');

/**
 * Search. `searchBy` picks the field: all (default) | orderId | mobile | awb | name.
 * Mobile accepts "+91 98765 43210" or "098765-43210" (only the digits are used) and also a partial number.
 */
const searchClause = async (search, searchBy = 'all') => {
  const text = String(search || '').trim();
  if (!text) return null;
  const rx = new RegExp(escapeRx(text), 'i');
  const mobileText = digits(text).length > 10 ? digits(text).slice(-10) : digits(text);
  const customerIds = async (cond) => (await Customer.find(cond).select('_id').limit(2000)).map((c) => c._id);

  if (searchBy === 'orderId') return { orderId: rx };
  if (searchBy === 'awb') return { $or: [{ 'shipping.awb': rx }, { 'courier.awb': rx }] };
  if (searchBy === 'name') return { customer: { $in: await customerIds({ name: rx }) } };
  if (searchBy === 'mobile') {
    if (!mobileText) return { _id: null };
    return { customer: { $in: await customerIds({ mobile: new RegExp(escapeRx(mobileText)) }) } };
  }
  const cust = [{ name: rx }, { pincode: rx }];
  if (mobileText.length >= 3) cust.push({ mobile: new RegExp(escapeRx(mobileText)) });
  return {
    $or: [
      { orderId: rx }, { 'shipping.awb': rx }, { 'courier.awb': rx },
      { customer: { $in: await customerIds({ $or: cust }) } },
    ],
  };
};

exports.list = asyncHandler(async (req, res) => {
  const { filter, page, limit, sort } = parseListQuery(req.query, { filterFields: ['agent', 'warehouse', 'createdBy'] });
  // Business date of the order (the date shown in the list), not the day the row was saved
  delete filter.createdAt;
  if (req.query.from || req.query.to) {
    filter.orderDate = {}; // days are Indian days (IST), so "today" means today in India
    if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '')) filter.orderDate.$gte = new Date(`${req.query.from}T00:00:00+05:30`);
    if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '')) filter.orderDate.$lte = new Date(`${req.query.to}T23:59:59.999+05:30`);
    if (!Object.keys(filter.orderDate).length) delete filter.orderDate;
  }

  if (req.query.tab && STAGES[req.query.tab]) Object.assign(filter, STAGES[req.query.tab]);
  // status can be one value or a comma list ("in_transit,out_for_delivery")
  if (req.query.status) {
    const list = String(req.query.status).split(',').filter(Boolean);
    filter.status = list.length > 1 ? { $in: list } : list[0];
  }
  if (req.query.payment) filter['payment.type'] = req.query.payment;
  if (req.query.provider) filter['shipping.provider'] = req.query.provider;
  if (req.query.transport) filter['shipping.mode'] = req.query.transport; // surface | air

  const clauses = [];
  const search = await searchClause(req.query.search, req.query.searchBy);
  if (search) clauses.push(search);
  if (req.query.mobile) clauses.push(await searchClause(req.query.mobile, 'mobile'));
  if (req.query.awb) clauses.push(await searchClause(req.query.awb, 'awb'));
  if (clauses.length) filter.$and = clauses;

  Object.assign(filter, scopeFor(req.user)); // last, so an agent can never widen their own view with ?agent=

  const [data, total] = await Promise.all([
    // lean + no history / scan lists: the table does not need them, so the page is much lighter and faster
    Order.find(filter).select('-statusHistory -shipping.trackHistory')
      .populate('customer', 'name mobile city state pincode').populate('agent', 'name mobile').populate('warehouse', 'title city pincode')
      .sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments(filter),
  ]);
  res.json(paginated(data, total, page, limit));
});

// Count for every tab: { all, pending, confirmed, ready_to_ship, ... }. One grouped query instead of one per tab.
exports.counts = asyncHandler(async (req, res) => {
  const rows = await Order.aggregate([
    { $match: scopeFor(req.user) },
    { $group: { _id: { status: '$status', manifested: { $cond: [{ $ifNull: ['$shipping.manifestedAt', false] }, true, false] } }, n: { $sum: 1 } } },
  ]);
  const sum = (fn) => rows.filter((r) => fn(r._id)).reduce((n, r) => n + r.n, 0);
  const is = (...list) => (id) => list.includes(id.status);
  res.json({
    all: sum(() => true),
    pending: sum(is('new_order', 'agent_assigned')),
    confirmed: sum(is('confirmed')),
    ready_to_ship: sum((id) => id.status === 'ready_for_dispatch' && !id.manifested),
    ready_to_pickup: sum((id) => id.status === 'ready_for_dispatch' && id.manifested),
    in_transit: sum(is('in_transit', 'out_for_delivery')),
    ndr: sum(is('ndr')),
    delivered: sum(is('delivered', 'invoice_generated')),
    rto: sum(is('rto', 'rto_delivered')),
    cancelled: sum(is('cancelled')),
  });
});

exports.getOne = asyncHandler(async (req, res) => {
  const order = await loadOrder(req);
  await respond(res, order);
});

exports.create = asyncHandler(async (req, res) => {
  const order = await service.createOrder(req.body, req.user);
  await respond(res, order, 201);
});

exports.update = asyncHandler(async (req, res) => {
  const order = await loadOrder(req);
  await service.updateOrder(order, req.body, req.user);
  await respond(res, order);
});

exports.confirm = asyncHandler(async (req, res) => {
  const order = await loadOrder(req);
  await order.populate('customer');
  await service.confirmOrder(order, req.user, req.body?.note);
  await respond(res, order);
});

exports.assignAgent = asyncHandler(async (req, res) => {
  const order = await loadOrder(req);
  await service.assignAgent(order, req.body.agentId, req.user);
  await respond(res, order);
});

exports.cancel = asyncHandler(async (req, res) => {
  const order = await loadOrder(req);
  await service.cancelOrder(order, req.body.note, req.user);
  await respond(res, order);
});

// ---------------- bulk ----------------
const loadMany = async (req) => {
  const ids = [...new Set(Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [])];
  if (!ids.length) throw new ApiError(400, 'Select at least one order');
  if (ids.length > 200) throw new ApiError(400, 'Select at most 200 orders at a time');
  // An agent can only ever touch their own orders, even in bulk
  return Order.find({ _id: { $in: ids }, ...scopeFor(req.user) }).populate('customer');
};

const summary = (results) => ({
  results,
  ok: results.filter((r) => r.ok).length,
  failed: results.filter((r) => !r.ok).length,
});

exports.bulkConfirm = asyncHandler(async (req, res) => {
  const orders = await loadMany(req);
  res.json(summary(await service.runBulk(orders, (o) => service.confirmOrder(o, req.user))));
});

exports.bulkCancel = asyncHandler(async (req, res) => {
  const orders = await loadMany(req);
  res.json(summary(await service.runBulk(orders, (o) => service.cancelOrder(o, req.body.note, req.user))));
});

exports.bulkAssign = asyncHandler(async (req, res) => {
  if (!req.body?.agentId) throw new ApiError(400, 'Choose an agent');
  const orders = await loadMany(req);
  res.json(summary(await service.runBulk(orders, (o) => service.assignAgent(o, req.body.agentId, req.user))));
});

exports.bulkImport = asyncHandler(async (req, res) => {
  res.json(await service.bulkImport(req.body?.rows, req.user));
});
