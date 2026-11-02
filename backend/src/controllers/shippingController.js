const Order = require('../models/Order');
const Warehouse = require('../models/Warehouse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const registry = require('../services/shipping');
const svc = require('../services/orderShippingService');

const POPULATE = [
  { path: 'customer' },
  { path: 'zone', select: 'name' },
  { path: 'agent', select: 'name mobile' },
  { path: 'statusHistory.by', select: 'name' },
];

const load = async (req) => {
  const order = await Order.findById(req.params.id).populate('customer');
  if (!order) throw new ApiError(404, 'Order not found');
  return order;
};

// Runs a service fn that returns { order, result } and replies with the refreshed order.
const orderAction = (fn) => asyncHandler(async (req, res) => {
  const order = await load(req);
  const { order: saved, result } = await fn(order, order.customer, req);
  await saved.populate(POPULATE);
  res.json({ order: saved, result });
});

// ---------- global tools ----------
exports.providers = asyncHandler(async (req, res) => res.json(registry.list()));

exports.status = asyncHandler(async (req, res) => {
  const results = await Promise.all(registry.list().map(async (m) => ({ ...m, ...(await registry.get(m.id).status()) })));
  res.json(results);
});

exports.couriers = asyncHandler(async (req, res) => {
  const provider = registry.getConfigured(req.query.provider || 'xpressbees');
  if (!provider.couriers) throw new ApiError(400, `${provider.displayName} has no courier list API`);
  res.json(await provider.couriers());
});

exports.returnReasons = asyncHandler(async (req, res) => {
  const provider = registry.getConfigured(req.query.provider || 'shipmozo');
  if (!provider.returnReasons) return res.json([]);
  res.json(await provider.returnReasons());
});

// ---- warehouses (stored in our DB; Xpressbees takes the pickup address with each booking) ----
exports.warehouses = asyncHandler(async (req, res) => {
  res.json(await Warehouse.find({ active: true }).sort({ isDefault: -1, title: 1 }));
});

exports.createWarehouse = asyncHandler(async (req, res) => {
  const b = req.body;
  const missing = ['title', 'name', 'phone', 'address', 'city', 'state', 'pincode'].filter((k) => !b[k]);
  if (missing.length) throw new ApiError(400, `Missing: ${missing.join(', ')}`);
  if (!/^\d{6}$/.test(String(b.pincode))) throw new ApiError(400, 'Pincode must be 6 digits');
  if (await Warehouse.exists({ title: b.title.trim() })) throw new ApiError(400, 'A warehouse with this title already exists');
  if (b.isDefault) await Warehouse.updateMany({}, { isDefault: false });
  res.status(201).json(await Warehouse.create(b));
});

exports.deleteWarehouse = asyncHandler(async (req, res) => {
  const wh = await Warehouse.findByIdAndUpdate(req.params.id, { active: false, isDefault: false }, { new: true });
  if (!wh) throw new ApiError(404, 'Warehouse not found');
  res.json({ ok: true });
});

// ---- rates / serviceability (no order needed) ----
const needPincodes = (b) => {
  if (!/^\d{6}$/.test(String(b.origin || '')) || !/^\d{6}$/.test(String(b.destination || ''))) {
    throw new ApiError(400, 'Enter valid 6-digit pickup and delivery pincodes');
  }
};

exports.rateCalculator = asyncHandler(async (req, res) => {
  needPincodes(req.body);
  const b = req.body;
  const missing = ['weight', 'length', 'width', 'height', 'orderAmount'].filter((k) => !b[k]);
  if (missing.length) throw new ApiError(400, `Missing: ${missing.join(', ')}`);
  const wanted = Array.isArray(b.providers) && b.providers.length ? b.providers.map(registry.getConfigured) : registry.configured();
  if (!wanted.length) throw new ApiError(503, 'No courier is configured. Add Xpressbees or Shipmozo keys in backend/.env');
  const results = await Promise.allSettled(wanted.map((p) => p.rates(b)));
  res.json(wanted.map((p, i) => ({
    provider: p.id, label: p.displayName,
    couriers: results[i].status === 'fulfilled' ? results[i].value : [],
    error: results[i].status === 'rejected' ? results[i].reason.message : undefined,
  })));
});

exports.serviceability = asyncHandler(async (req, res) => {
  needPincodes(req.body);
  const wanted = registry.configured();
  if (!wanted.length) throw new ApiError(503, 'No courier is configured. Add Xpressbees or Shipmozo keys in backend/.env');
  const results = await Promise.allSettled(wanted.map((p) => p.serviceability(req.body)));
  res.json(wanted.map((p, i) => ({
    provider: p.id, label: p.displayName,
    serviceable: results[i].status === 'fulfilled' ? results[i].value.serviceable : null,
    couriers: results[i].status === 'fulfilled' ? results[i].value.couriers.length : 0,
    error: results[i].status === 'rejected' ? results[i].reason.message : undefined,
  })));
});

// ---- NDR / exceptions (Xpressbees only) ----
const xb = () => registry.getConfigured('xpressbees');

exports.ndrList = asyncHandler(async (req, res) => {
  const list = await xb().ndrList();
  const awbs = list.map((n) => n.awb_number);
  const orders = await Order.find({ 'courier.awb': { $in: awbs } }).select('orderId courier.awb');
  const byAwb = Object.fromEntries(orders.map((o) => [o.courier.awb, o.orderId]));
  res.json(list.map((n) => ({ ...n, orderId: byAwb[n.awb_number] || null })));
});

const NDR_ACTIONS = ['re-attempt', 'change_address', 'change_phone'];
exports.ndrAction = asyncHandler(async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  if (!items.length || items.length > 100) throw new ApiError(400, 'Send between 1 and 100 NDR actions');
  for (const i of items) {
    if (!i.awb || !NDR_ACTIONS.includes(i.action)) {
      throw new ApiError(400, `Each item needs awb and an action: ${NDR_ACTIONS.join(', ')}`);
    }
  }
  const results = await xb().ndrCreate(items);
  const failed = results.filter((r) => r.status !== true);
  if (failed.length === results.length) throw new ApiError(400, `Xpressbees: ${failed[0]?.message || 'NDR action failed'}`);
  res.json(results);
});

// ---------- per order ----------
exports.rates = asyncHandler(async (req, res) => {
  const order = await load(req);
  res.json(await svc.getRates(order, order.customer, req.body));
});
exports.book = orderAction((order, customer, req) => svc.book(order, customer, req.body, req.user));
exports.track = orderAction((order, c, req) => svc.track(order, req.user));
exports.manifest = orderAction((order, c, req) => svc.manifest(order, req.user));
exports.cancel = orderAction((order, c, req) => svc.cancel(order, req.user));
exports.orderNdr = orderAction((order, c, req) => svc.ndrAction(order, req.body, req.user));
exports.pushReturn = orderAction((order, customer, req) => svc.pushReturn(order, customer, req.body, req.user));
exports.label = asyncHandler(async (req, res) => res.json(await svc.label(await load(req))));
