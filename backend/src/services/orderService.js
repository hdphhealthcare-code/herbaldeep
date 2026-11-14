const Order = require('../models/Order');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Warehouse = require('../models/Warehouse');
const User = require('../models/User');
const Counter = require('../models/Counter');
const ApiError = require('../utils/ApiError');
const { changeStock } = require('./inventoryService');
const { priceLines } = require('../utils/pricing');
const shippingSvc = require('./orderShippingService');
const { CANCELLABLE_STATUS, FINAL_STATUS, MAX_AGENT_CHANGES, PRE_CONFIRM_STATUS, EDITABLE_STATUS, ORDER_PREFIX, ORDER_PAD } = require('../config/constants');

const pushHistory = (order, status, note, userId) => {
  order.statusHistory.push({ status, note, by: userId });
};

const num = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));

const readParcel = (p = {}) => {
  const parcel = { weight: num(p.weight), length: num(p.length), width: num(p.width), height: num(p.height) };
  Object.entries(parcel).forEach(([k, v]) => {
    if (v !== undefined && (!Number.isFinite(v) || v <= 0)) throw new ApiError(400, `Parcel ${k} must be a positive number`);
  });
  return parcel;
};

const validateNewCustomer = (c = {}) => {
  const missing = ['name', 'mobile', 'address', 'pincode', 'city', 'state'].filter((k) => !String(c[k] || '').trim());
  if (missing.length) throw new ApiError(400, `Customer ${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} required`);
  if (!/^\d{6}$/.test(String(c.pincode).trim())) throw new ApiError(400, 'Customer pincode must be 6 digits');
  if (String(c.mobile).replace(/\D/g, '').length < 10) throw new ApiError(400, 'Customer mobile must have 10 digits');
};

// GSTIN: 2 digit state code, 10 character PAN, entity number, Z, check character
const GSTIN_RX = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const readGstNumber = (v) => {
  const gst = String(v || '').replace(/\s+/g, '').toUpperCase();
  if (!gst) return undefined; // the GST number is optional
  if (!GSTIN_RX.test(gst)) throw new ApiError(400, 'GST number must be a valid 15-character GSTIN, for example 24ABCDE1234F1Z5');
  return gst;
};

/**
 * Customer of the order: an existing one or a new one typed in on the order form.
 * A customer belongs to whoever added it. An agent can only pick their own customers (the customer already on the
 * order stays allowed, so older orders can still be edited); a new customer is saved under the agent's name.
 */
const resolveCustomer = async ({ customerId, customer: newCustomer }, user, { allow = [] } = {}) => {
  let customer;
  if (customerId) {
    customer = await Customer.findById(customerId).catch(() => null);
    if (customer && user?.role === 'agent' && !allow.map(String).includes(String(customer._id))
      && String(customer.createdBy || '') !== String(user._id)) {
      throw new ApiError(403, 'This customer was added by someone else. Add them as a new customer instead');
    }
  } else {
    validateNewCustomer(newCustomer);
    const { createdBy, ...fields } = newCustomer; // the owner is never taken from the request
    customer = await Customer.create({ ...fields, createdBy: user?._id });
  }
  if (!customer) throw new ApiError(404, 'Customer not found');
  return customer;
};

// keepPrices: product id -> price already on the order (an edit keeps the price the customer was quoted)
const loadItems = async (items = [], keepPrices = {}) => {
  if (!items.length) throw new ApiError(400, 'Add at least one product');
  const lines = [];
  for (const it of items) {
    const qty = Number(it.quantity);
    if (!Number.isInteger(qty) || qty < 1) throw new ApiError(400, 'Product quantity must be a whole number, at least 1');
    const p = await Product.findById(it.product).catch(() => null);
    if (!p || !p.isActive) throw new ApiError(400, 'One of the selected products is unavailable');
    lines.push({
      product: p._id, name: p.name, sku: p.sku, quantity: qty,
      price: keepPrices[String(p._id)] ?? p.price,
      discount: Number(it.discount || 0),
    });
  }
  return lines;
};

const loadWarehouse = async (warehouseId) => {
  if (!warehouseId) return null;
  const wh = await Warehouse.findById(warehouseId).catch(() => null);
  if (!wh || !wh.active) throw new ApiError(400, 'Selected pickup warehouse was not found');
  return wh;
};

// Takes stock for the items; if one fails, whatever was already taken is put back
const reserveStock = async (items, order, user, reason) => {
  const done = [];
  try {
    for (const it of items) {
      await changeStock({ productId: it.product, change: -it.quantity, type: 'out', reason, orderId: order._id, userId: user._id });
      done.push(it);
    }
  } catch (err) {
    await releaseStock(done, order, user, 'Order change rolled back');
    throw err;
  }
};
const releaseStock = async (items, order, user, reason) => {
  for (const it of items) {
    await changeStock({ productId: it.product, change: it.quantity, type: 'return', reason, orderId: order._id, userId: user._id });
  }
};

const paymentOf = (payment = {}, totalAmount) => {
  const cod = payment.type === 'COD';
  return { type: cod ? 'COD' : 'PREPAID', codAmount: cod ? Number(payment.codAmount || totalAmount) : 0 };
};

/**
 * Create order. Flow: customer (+ pincode, state, city) -> products (price includes 5% GST) with flat discount -> parcel & payment.
 * The courier is chosen later with "Ship now"; from then on the status follows the courier by itself.
 */
exports.createOrder = async (body, user) => {
  const { items = [], notes, orderDate, warehouseId, payment, parcel } = body;
  // An agent's order always belongs to that agent (the body cannot assign it to somebody else)
  const agentId = user.role === 'agent' ? user._id : body.agentId;
  if (!items.length) throw new ApiError(400, 'Add at least one product');
  const customer = await resolveCustomer(body, user);
  const gstNumber = readGstNumber(body.gstNumber);
  const priced = priceLines(await loadItems(items));

  let agent = null;
  if (agentId) {
    agent = await User.findOne({ _id: agentId, role: 'agent', isActive: true });
    if (!agent) throw new ApiError(400, 'Selected agent is not available');
  }
  const warehouse = await loadWarehouse(warehouseId);

  const order = new Order({
    orderId: await Counter.nextCode('order_hbd', ORDER_PREFIX, ORDER_PAD),
    customer: customer._id,
    items: priced.lines,
    subtotal: priced.subtotal,
    discountTotal: priced.discountTotal,
    gstRate: priced.gstRate,
    gstAmount: priced.gstAmount,
    taxableAmount: priced.taxableAmount,
    taxInclusive: true,
    gstNumber,
    totalAmount: priced.totalAmount,
    orderDate: orderDate || Date.now(),
    notes,
    agent: agent?._id,
    warehouse: warehouse?._id,
    payment: paymentOf(payment, priced.totalAmount),
    parcel: readParcel(parcel),
    status: agent ? 'agent_assigned' : 'new_order',
    createdBy: user._id,
  });
  pushHistory(order, 'new_order', 'Order created', user._id);
  if (agent) pushHistory(order, 'agent_assigned', `Assigned to ${agent.name}`, user._id);

  await reserveStock(priced.lines, order, user, `Order ${order.orderId}`); // IMS: reserve stock
  await order.save();
  return order;
};

/**
 * Edit an order that is not shipped yet (customer, products, discount, payment, parcel, warehouse, notes).
 * Stock is swapped: the old items go back, the new ones are taken; if that fails nothing changes.
 */
exports.updateOrder = async (order, body, user) => {
  if (order.shipping?.status === 'booked') throw new ApiError(400, 'This order is already shipped. Cancel the shipment first to edit it');
  if (!EDITABLE_STATUS.includes(order.status)) throw new ApiError(400, 'Only orders that are not shipped yet can be edited');
  // An agent edits only until the order is confirmed; after that it is with the admin for shipping
  if (user.role === 'agent' && !PRE_CONFIRM_STATUS.includes(order.status)) {
    throw new ApiError(403, 'This order is confirmed, so only an admin can change it now');
  }

  const { items = [], notes, orderDate, warehouseId, payment, parcel } = body;
  if (!items.length) throw new ApiError(400, 'Add at least one product');
  const customer = await resolveCustomer(body, user, { allow: [order.customer?._id || order.customer] });
  const gstNumber = readGstNumber(body.gstNumber);
  // The quoted price is kept on edit. Orders from before v3.4 had prices WITHOUT GST, so they are re-priced from the catalogue
  const keep = order.taxInclusive ? Object.fromEntries(order.items.map((i) => [String(i.product), i.price])) : {};
  const priced = priceLines(await loadItems(items, keep));
  const warehouse = await loadWarehouse(warehouseId);
  const parcelData = readParcel(parcel);

  const oldItems = order.items.map((i) => ({ product: i.product, quantity: i.quantity }));
  await releaseStock(oldItems, order, user, `Order ${order.orderId} edited`);
  try {
    await reserveStock(priced.lines, order, user, `Order ${order.orderId} edited`);
  } catch (err) {
    await reserveStock(oldItems, order, user, `Order ${order.orderId} edit failed`); // back to how it was
    throw err;
  }

  order.customer = customer._id;
  order.items = priced.lines;
  order.subtotal = priced.subtotal;
  order.discountTotal = priced.discountTotal;
  order.gstRate = priced.gstRate;
  order.gstAmount = priced.gstAmount;
  order.taxableAmount = priced.taxableAmount;
  order.taxInclusive = true;
  order.gstNumber = gstNumber;
  order.totalAmount = priced.totalAmount;
  order.orderDate = orderDate || order.orderDate;
  order.notes = notes;
  order.warehouse = warehouse?._id;
  order.payment = paymentOf(payment, priced.totalAmount);
  order.parcel = parcelData;
  pushHistory(order, order.status, 'Order edited', user._id);
  return order.save();
};

/**
 * Assign an agent, or change it. The first assignment is free; the agent can then be changed
 * MAX_AGENT_CHANGES time(s). After that the assignment is locked for good.
 */
exports.assignAgent = async (order, agentId, user) => {
  if (FINAL_STATUS.includes(order.status)) throw new ApiError(400, 'The agent of a finished order cannot be changed');
  const reassigning = Boolean(order.agent);
  if (reassigning && (order.agentChanges || 0) >= MAX_AGENT_CHANGES) {
    throw new ApiError(400, 'The agent was already changed once and is now locked. It cannot be changed again');
  }
  if (reassigning && String(order.agent?._id || order.agent) === String(agentId)) {
    throw new ApiError(400, 'This agent is already assigned to the order');
  }
  const agent = await User.findOne({ _id: agentId, role: 'agent', isActive: true });
  if (!agent) throw new ApiError(400, 'Selected agent is not available');

  const previous = reassigning ? (order.agent?.name || (await User.findById(order.agent).select('name'))?.name) : undefined;
  order.agent = agent._id;
  if (reassigning) order.agentChanges = (order.agentChanges || 0) + 1;
  if (order.status === 'new_order') order.status = 'agent_assigned';
  pushHistory(
    order, order.status,
    reassigning ? `Agent changed${previous ? ` from ${previous}` : ''} to ${agent.name}` : `Assigned to ${agent.name}`,
    user._id
  );
  return order.save();
};

/**
 * Cancel an order before the courier picks it up. A booked shipment is cancelled with the courier first
 * and the reserved stock goes back to inventory.
 */
exports.cancelOrder = async (order, note, user) => {
  if (order.status === 'cancelled') throw new ApiError(400, 'This order is already cancelled');
  if (!CANCELLABLE_STATUS.includes(order.status)) {
    throw new ApiError(400, 'The courier has already picked this order up, so it cannot be cancelled now');
  }
  if (order.shipping?.status === 'booked') {
    if (!order.shipping.awb) throw new ApiError(400, 'The AWB is still pending. Press "Refresh status" to fetch it, then cancel');
    await shippingSvc.cancel(order, user); // cancels with the courier, may throw
  }
  for (const it of order.items) {
    await changeStock({
      productId: it.product, change: it.quantity, type: 'return',
      reason: `Order ${order.orderId} cancelled`, orderId: order._id, userId: user._id,
    });
  }
  order.status = 'cancelled';
  pushHistory(order, 'cancelled', note || 'Order cancelled', user._id);
  return order.save();
};

/**
 * Confirm an order: the step between "order created" and "ready to ship".
 * The agent (for their own order) or an admin confirms it; only a confirmed order can be shipped.
 */
exports.confirmOrder = async (order, user, note) => {
  if (order.status === 'confirmed') throw new ApiError(400, 'This order is already confirmed');
  if (!PRE_CONFIRM_STATUS.includes(order.status)) throw new ApiError(400, 'Only a new order can be confirmed');
  const customer = order.customer?.pincode !== undefined ? order.customer : await Customer.findById(order.customer);
  if (!customer || !/^\d{6}$/.test(String(customer.pincode || ''))) {
    throw new ApiError(400, 'The customer has no valid 6-digit pincode, so this order cannot be confirmed. Edit the order first');
  }
  if (!String(customer.address || '').trim() || !String(customer.state || '').trim()) {
    throw new ApiError(400, 'The customer address or state is missing, so this order cannot be confirmed. Edit the order first');
  }
  order.status = 'confirmed';
  order.confirmedBy = user._id;
  order.confirmedAt = new Date();
  pushHistory(order, 'confirmed', note || 'Order confirmed', user._id);
  return order.save();
};

// ---------- bulk helpers: every order is handled on its own, so one bad order never blocks the rest ----------
exports.runBulk = async (orders, fn) => {
  const results = [];
  for (const order of orders) {
    try {
      await fn(order);
      results.push({ id: String(order._id), orderId: order.orderId, ok: true });
    } catch (err) {
      results.push({ id: String(order._id), orderId: order.orderId, ok: false, message: err.message });
    }
  }
  return results;
};

const normMobile = (v) => String(v || '').replace(/\D/g, '').slice(-10);

/**
 * Bulk order upload. `rows` come from a CSV: one row per product line; rows with the same `order_ref` become ONE order
 * with several products (a row without order_ref is its own order). Each order is created on its own and
 * failures are reported per order, so a wrong SKU in one order does not block the others.
 */
exports.bulkImport = async (rows, user) => {
  if (!Array.isArray(rows) || !rows.length) throw new ApiError(400, 'The file has no rows');
  if (rows.length > 500) throw new ApiError(400, 'Upload at most 500 rows at a time');

  const groups = new Map();
  rows.forEach((r, i) => {
    const key = String(r.order_ref || '').trim() || `__row_${i}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...r, line: i + 2 }); // +2: header is line 1
  });

  const defaultWh = await Warehouse.findOne({ active: true }).sort({ isDefault: -1 });
  const created = []; const failed = [];

  for (const [ref, lines] of groups) {
    const first = lines[0];
    const label = ref.startsWith('__row_') ? `row ${first.line}` : `order_ref ${ref} (row ${first.line})`;
    try {
      const items = [];
      for (const l of lines) {
        const sku = String(l.sku || '').trim();
        if (!sku) throw new ApiError(400, `row ${l.line}: sku is required`);
        const product = await Product.findOne({ sku: sku.toUpperCase(), isActive: true });
        if (!product) throw new ApiError(400, `row ${l.line}: product with SKU "${sku}" was not found`);
        items.push({ product: product._id, quantity: Number(l.quantity || 1), discount: Number(l.discount || 0) });
      }
      const type = String(first.payment_type || 'PREPAID').trim().toUpperCase();
      if (!['PREPAID', 'COD'].includes(type)) throw new ApiError(400, 'payment_type must be PREPAID or COD');
      const order = await exports.createOrder({
        customer: {
          name: first.name, mobile: normMobile(first.mobile), address: first.address, area: first.area,
          city: first.city, state: first.state, pincode: String(first.pincode || '').trim(),
        },
        items,
        payment: { type, codAmount: first.cod_amount ? Number(first.cod_amount) : 0 },
        parcel: { weight: first.weight_g, length: first.length_cm, width: first.width_cm, height: first.height_cm },
        warehouseId: defaultWh?._id,
        notes: first.notes,
        gstNumber: first.gst_number,
        agentId: user.role === 'agent' ? undefined : (first.agent_id || undefined),
      }, user);
      created.push({ orderId: order.orderId, ref: ref.startsWith('__row_') ? '' : ref, line: first.line });
    } catch (err) {
      failed.push({ label, line: first.line, message: err.message });
    }
  }
  return { created, failed, total: groups.size };
};
