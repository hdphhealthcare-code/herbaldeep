const Order = require('../models/Order');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Zone = require('../models/Zone');
const User = require('../models/User');
const Counter = require('../models/Counter');
const ApiError = require('../utils/ApiError');
const { changeStock } = require('./inventoryService');
const { AGENT_ALLOWED_STATUS, ORDER_STATUS } = require('../config/constants');

const pushHistory = (order, status, note, userId) => {
  order.statusHistory.push({ status, note, by: userId });
};

// Match a customer's city/area against active zones' service areas.
const identifyZone = async (customer) => {
  const keys = [customer.city, customer.area].filter(Boolean).map((s) => s.trim().toLowerCase());
  if (!keys.length) return null;
  return Zone.findOne({ isActive: true, areas: { $in: keys } });
};

exports.createOrder = async (body, user) => {
  const { customerId, customer: newCustomer, items = [], notes, orderDate, zoneId } = body;
  if (!items.length) throw new ApiError(400, 'Add at least one product');

  const customer = customerId ? await Customer.findById(customerId) : await Customer.create(newCustomer);
  if (!customer) throw new ApiError(404, 'Customer not found');

  const orderItems = [];
  for (const it of items) {
    const p = await Product.findById(it.product);
    if (!p || !p.isActive) throw new ApiError(400, 'One of the selected products is unavailable');
    orderItems.push({ product: p._id, name: p.name, sku: p.sku, price: p.price, quantity: Number(it.quantity) });
  }

  const zone = zoneId ? await Zone.findById(zoneId) : await identifyZone(customer);
  const order = new Order({
    orderId: await Counter.nextCode('order', 'ORD'),
    customer: customer._id,
    items: orderItems,
    totalAmount: orderItems.reduce((s, i) => s + i.price * i.quantity, 0),
    orderDate: orderDate || Date.now(),
    notes,
    zone: zone?._id,
    status: zone ? 'zone_identified' : 'new_order',
    createdBy: user._id,
  });
  pushHistory(order, 'new_order', 'Order created', user._id);
  if (zone) pushHistory(order, 'zone_identified', `Zone: ${zone.name}`, user._id);

  // IMS: reserve stock; roll back on failure
  const done = [];
  try {
    for (const it of orderItems) {
      await changeStock({
        productId: it.product, change: -it.quantity, type: 'out',
        reason: `Order ${order.orderId}`, orderId: order._id, userId: user._id,
      });
      done.push(it);
    }
  } catch (err) {
    for (const it of done) {
      await changeStock({ productId: it.product, change: it.quantity, type: 'return', reason: 'Order creation rolled back', userId: user._id });
    }
    throw err;
  }
  await order.save();
  return order;
};

exports.assignAgent = async (order, agentId, user) => {
  const agent = await User.findOne({ _id: agentId, role: 'agent', isActive: true });
  if (!agent) throw new ApiError(400, 'Selected agent is not available');
  const reassigned = !!order.agent;
  order.agent = agent._id;
  if (!order.zone && agent.zone) order.zone = agent.zone;
  if (['new_order', 'zone_identified', 'agent_assigned'].includes(order.status)) order.status = 'agent_assigned';
  pushHistory(order, order.status, `${reassigned ? 'Reassigned to' : 'Assigned to'} ${agent.name}`, user._id);
  return order.save();
};

exports.updateCourier = async (order, courier, user) => {
  order.courier = { ...order.courier.toObject(), ...courier };
  if (courier.dispatchStatus === 'dispatched' && order.status !== 'dispatched') {
    order.status = 'dispatched';
    pushHistory(order, 'dispatched', 'Courier dispatched', user._id);
  }
  if (courier.deliveryStatus === 'delivered' && order.status !== 'delivered') {
    order.status = 'delivered';
    pushHistory(order, 'delivered', 'Courier marked delivered', user._id);
  }
  return order.save();
};

exports.updateStatus = async (order, status, note, user) => {
  if (!ORDER_STATUS.includes(status)) throw new ApiError(400, 'Invalid status');
  if (user.role === 'agent') {
    if (String(order.agent) !== String(user._id)) throw new ApiError(403, 'This order is not assigned to you');
    if (!AGENT_ALLOWED_STATUS.includes(status)) throw new ApiError(403, 'You cannot set this status');
  }
  if (order.status === 'cancelled') throw new ApiError(400, 'Cancelled orders cannot be changed');

  if (status === 'cancelled') {
    for (const it of order.items) {
      await changeStock({
        productId: it.product, change: it.quantity, type: 'return',
        reason: `Order ${order.orderId} cancelled`, orderId: order._id, userId: user._id,
      });
    }
  }
  order.status = status;
  if (status === 'dispatched') order.courier.dispatchStatus = 'dispatched';
  if (status === 'delivered') order.courier.deliveryStatus = 'delivered';
  pushHistory(order, status, note, user._id);
  return order.save();
};
