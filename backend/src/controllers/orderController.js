const Order = require('../models/Order');
const Customer = require('../models/Customer');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { parseListQuery, paginated } = require('../utils/pagination');
const service = require('../services/orderService');

const POPULATE = [
  { path: 'customer' },
  { path: 'zone', select: 'name' },
  { path: 'agent', select: 'name mobile' },
  { path: 'statusHistory.by', select: 'name' },
];

// Agents may only ever see their own orders.
const scopeFor = (user) => (user.role === 'agent' ? { agent: user._id } : {});

const loadOrder = async (req) => {
  const order = await Order.findOne({ _id: req.params.id, ...scopeFor(req.user) });
  if (!order) throw new ApiError(404, 'Order not found');
  return order;
};

const respond = async (res, order, status = 200) => {
  await order.populate(POPULATE);
  res.status(status).json(order);
};

exports.list = asyncHandler(async (req, res) => {
  const { filter, page, limit, sort } = parseListQuery(req.query, {
    filterFields: ['status', 'zone', 'agent'],
  });
  Object.assign(filter, scopeFor(req.user));

  if (req.query.search) {
    const rx = new RegExp(req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const customers = await Customer.find({ $or: [{ name: rx }, { mobile: rx }] }).select('_id');
    filter.$or = [{ orderId: rx }, { customer: { $in: customers.map((c) => c._id) } }];
  }
  const [data, total] = await Promise.all([
    Order.find(filter).populate('customer zone agent', 'name mobile city').sort(sort).skip((page - 1) * limit).limit(limit),
    Order.countDocuments(filter),
  ]);
  res.json(paginated(data, total, page, limit));
});

exports.getOne = asyncHandler(async (req, res) => {
  const order = await loadOrder(req);
  await respond(res, order);
});

exports.create = asyncHandler(async (req, res) => {
  const order = await service.createOrder(req.body, req.user);
  await respond(res, order, 201);
});

exports.assignAgent = asyncHandler(async (req, res) => {
  const order = await loadOrder(req);
  await service.assignAgent(order, req.body.agentId, req.user);
  await respond(res, order);
});

exports.updateCourier = asyncHandler(async (req, res) => {
  const order = await loadOrder(req);
  await service.updateCourier(order, req.body, req.user);
  await respond(res, order);
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const order = await loadOrder(req);
  await service.updateStatus(order, req.body.status, req.body.note, req.user);
  await respond(res, order);
});

exports.updateZone = asyncHandler(async (req, res) => {
  const order = await loadOrder(req);
  order.zone = req.body.zoneId;
  if (order.status === 'new_order') order.status = 'zone_identified';
  order.statusHistory.push({ status: order.status, note: 'Zone updated', by: req.user._id });
  await order.save();
  await respond(res, order);
});
