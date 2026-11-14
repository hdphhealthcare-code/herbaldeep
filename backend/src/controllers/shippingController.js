const Order = require('../models/Order');
const Warehouse = require('../models/Warehouse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const registry = require('../services/shipping');
const svc = require('../services/orderShippingService');
const poller = require('../services/trackingPoller');
const { scopeFor } = require('../utils/orderScope');
const { paginated } = require('../utils/pagination');
const { enrichCouriers, tagGroups } = require('../services/shipping/rateMeta');

const POPULATE = [
  { path: 'customer' },
  { path: 'agent', select: 'name mobile' },
  { path: 'statusHistory.by', select: 'name' },
];

// Every order is loaded through the same scope rule as the orders list: an agent only ever reaches their own orders
const load = async (req) => {
  const order = await Order.findOne({ _id: req.params.id, ...scopeFor(req.user) }).populate('customer');
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

exports.updateWarehouse = asyncHandler(async (req, res) => {
  const wh = await Warehouse.findOne({ _id: req.params.id, active: true });
  if (!wh) throw new ApiError(404, 'Warehouse not found');
  const b = req.body;
  const missing = ['title', 'name', 'phone', 'address', 'city', 'state', 'pincode'].filter((k) => !b[k]);
  if (missing.length) throw new ApiError(400, `Missing: ${missing.join(', ')}`);
  if (!/^\d{6}$/.test(String(b.pincode))) throw new ApiError(400, 'Pincode must be 6 digits');
  if (await Warehouse.exists({ title: b.title.trim(), _id: { $ne: wh._id } })) throw new ApiError(400, 'A warehouse with this title already exists');
  if (b.isDefault) await Warehouse.updateMany({ _id: { $ne: wh._id } }, { isDefault: false });
  // Couriers keep their own copy of the address: changing it here means a fresh registration on their side
  const moved = ['title', 'address', 'address2', 'city', 'state', 'pincode', 'phone'].some((k) => String(b[k] || '') !== String(wh[k] || ''));
  const fields = ['title', 'name', 'phone', 'email', 'address', 'address2', 'city', 'state', 'pincode', 'isDefault'];
  wh.set({ ...Object.fromEntries(fields.filter((k) => b[k] !== undefined).map((k) => [k, b[k]])), ...(moved ? { providerIds: {} } : {}) });
  res.json(await wh.save());
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
  res.json(tagGroups(wanted.map((p, i) => ({
    provider: p.id, label: p.displayName,
    couriers: results[i].status === 'fulfilled' ? enrichCouriers(results[i].value) : [],
    error: results[i].status === 'rejected' ? results[i].reason.message : undefined,
  }))));
});

exports.serviceability = asyncHandler(async (req, res) => {
  // Agents and the NDR team just type the customer's pincode: the pickup is the default warehouse
  const body = { ...req.body };
  if (!body.origin) {
    const wh = await Warehouse.findOne({ active: true }).sort({ isDefault: -1 });
    if (!wh) throw new ApiError(400, 'No pickup warehouse is set up yet. Ask an admin to add one under Shipping > Warehouses');
    body.origin = wh.pincode;
  }
  needPincodes(body);
  const wanted = registry.configured();
  if (!wanted.length) throw new ApiError(503, 'No courier is configured. Add Xpressbees or Shipmozo keys in backend/.env');
  const results = await Promise.allSettled(wanted.map((p) => p.serviceability(body)));
  res.json(wanted.map((p, i) => ({
    provider: p.id, label: p.displayName,
    serviceable: results[i].status === 'fulfilled' ? results[i].value.serviceable : null,
    couriers: results[i].status === 'fulfilled' ? results[i].value.couriers.length : 0,
    note: results[i].status === 'fulfilled' ? results[i].value.reason : undefined, // why a courier says no, when it tells
    error: results[i].status === 'rejected' ? results[i].reason.message : undefined,
  })));
});

// ---- NDR / exceptions: every courier platform ----
// The list is built from our own orders (status "ndr", kept live by the tracking sync / webhooks), so it covers
// Xpressbees, Shipmozo, Ekart, Delhivery and Shiprocket alike. An agent only sees their own orders (scopeFor).
const escapeRx = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.ndrList = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const filter = { status: 'ndr', 'shipping.status': 'booked' };
  if (req.query.provider) filter['shipping.provider'] = req.query.provider;
  const text = String(req.query.search || '').trim();
  if (text) {
    const rx = new RegExp(escapeRx(text), 'i');
    filter.$or = [{ orderId: rx }, { 'shipping.awb': rx }];
  }
  Object.assign(filter, scopeFor(req.user)); // last, so a query string can never widen an agent's view

  const [rows, total] = await Promise.all([
    Order.find(filter)
      .select('orderId orderDate payment totalAmount items agent customer status shipping updatedAt')
      .populate('customer', 'name mobile city state pincode').populate('agent', 'name')
      .sort('-updatedAt').skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments(filter),
  ]);

  // Xpressbees also publishes its own exception list (courier remarks, attempts): merge it in when it answers quickly
  let xb = {};
  if (rows.some((o) => (o.shipping?.provider || 'xpressbees') === 'xpressbees') && registry.get('xpressbees').isConfigured()) {
    try {
      const list = await Promise.race([registry.get('xpressbees').ndrList(), new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 6000))]);
      xb = Object.fromEntries((Array.isArray(list) ? list : []).map((n) => [String(n.awb_number), n]));
    } catch { /* the CRM's own data is enough */ }
  }

  const data = rows.map((o) => {
    const s = o.shipping || {};
    const provider = s.provider || 'xpressbees';
    const x = xb[String(s.awb)];
    return {
      _id: o._id,
      orderId: o.orderId,
      orderDate: o.orderDate,
      customer: o.customer,
      agent: o.agent,
      items: (o.items || []).map((i) => ({ name: i.name, quantity: i.quantity })),
      amount: o.payment?.type === 'COD' ? (o.payment.codAmount || o.totalAmount) : o.totalAmount,
      paymentType: o.payment?.type,
      provider,
      awb: s.awb,
      courierName: s.courierName,
      reason: x?.courier_remarks || s.ndr?.status || s.lastTrackStatus,
      attempts: x?.total_attempts ?? s.ndr?.attempts,
      lastTrackStatus: s.lastTrackStatus,
      lastEvents: (s.trackHistory || []).slice(0, 3),
      lastAction: s.ndr?.lastAction || null,
      raisedAt: x?.event_date || s.lastTrackedAt,
    };
  });
  res.json(paginated(data, total, page, limit));
});

// ---------- per order ----------
// Ask every courier about every booked, unfinished shipment right now (the same job that runs in the background)
exports.syncAll = asyncHandler(async (req, res) => {
  res.json(await poller.runOnce({ force: true }));
});

exports.rates = asyncHandler(async (req, res) => {
  const order = await load(req);
  res.json(await svc.getRates(order, order.customer, req.body));
});
exports.book = orderAction((order, customer, req) => svc.book(order, customer, req.body, req.user));
exports.track = orderAction((order, c, req) => svc.track(order, req.user));
exports.manifest = orderAction((order, c, req) => svc.manifest(order, req.user));
exports.cancel = orderAction((order, c, req) => svc.cancel(order, req.user));
exports.orderNdr = orderAction((order, c, req) => {
  if (order.status !== 'ndr') throw new ApiError(400, 'This order is not in NDR, so there is nothing to act on');
  return svc.ndrAction(order, req.body, req.user);
});
exports.pushReturn = orderAction((order, customer, req) => svc.pushReturn(order, customer, req.body, req.user));
exports.label = asyncHandler(async (req, res) => res.json(await svc.label(await load(req))));

// NDR team / admin / agent: act on many NDR orders at once (an agent only reaches their own orders).
// Each order is sent on its own, so one failure (for example a courier with no NDR API) never blocks the rest.
exports.bulkNdr = asyncHandler(async (req, res) => {
  const ids = [...new Set(Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [])];
  if (!ids.length) throw new ApiError(400, 'Select at least one order');
  if (ids.length > 100) throw new ApiError(400, 'Select at most 100 orders at a time');
  const { date, instructions, phone, address } = req.body;
  const action = req.body.action === 'RTO' ? 'RTO' : 'Re-Attempt';
  if (action === 'Re-Attempt' && !/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) throw new ApiError(400, 'Choose the re-attempt date');
  if ((phone || address) && ids.length > 1) throw new ApiError(400, 'A new phone or address can be sent for one order at a time');

  const orders = await Order.find({ _id: { $in: ids }, ...scopeFor(req.user) }).populate('customer');
  const found = new Set(orders.map((o) => String(o._id)));
  const results = ids.filter((id) => !found.has(id)).map((id) => ({ id, orderId: id, ok: false, message: 'Order not found' }));
  for (const order of orders) {
    try {
      if (order.status !== 'ndr') throw new ApiError(400, 'This order is not in NDR, so there is nothing to act on');
      await svc.ndrAction(order, { action, date, instructions, phone, address }, req.user);
      results.push({ id: String(order._id), orderId: order.orderId, ok: true });
    } catch (err) {
      results.push({ id: String(order._id), orderId: order.orderId, ok: false, message: err.message });
    }
  }
  res.json({ results, ok: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length });
});
