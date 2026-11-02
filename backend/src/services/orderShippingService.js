const registry = require('./shipping');
const Warehouse = require('../models/Warehouse');
const ApiError = require('../utils/ApiError');
const { readParcel, requireCustomerAddress } = require('./shipping/common');

/**
 * Connects a CRM order to a courier platform (Xpressbees or Shipmozo; see services/shipping/).
 *   rates -> book (AWB) -> label / manifest / track / cancel / return
 * This file holds the courier-independent parts: validation, saving the result on order.shipping and the
 * status history. The courier-specific API calls live in the provider files.
 */

const BEFORE_READY = ['new_order', 'zone_identified', 'agent_assigned'];

const patchShipping = (order, patch) => {
  const current = order.shipping?.toObject ? order.shipping.toObject() : order.shipping || {};
  order.shipping = { ...current, ...patch };
};
const log = (order, note, userId) => order.statusHistory.push({ status: order.status, note, by: userId });

// Orders booked before Shipmozo was added have no provider stored: they were Xpressbees
const providerOf = (order) => registry.get(order.shipping?.provider || 'xpressbees');
const refOf = (order) => (order.shipping?.attempts ? `${order.orderId}-B${order.shipping.attempts}` : order.orderId);

const requireBooked = (order) => {
  if (order.shipping?.status !== 'booked') throw new ApiError(400, 'This order is not booked with a courier yet');
};
const requireAwb = (order) => {
  requireBooked(order);
  if (!order.shipping.awb) throw new ApiError(400, 'No AWB yet. Press "Track shipment" to fetch it');
  return order.shipping.awb;
};

const loadWarehouse = async (id) => {
  if (!id) throw new ApiError(400, 'Select a pickup warehouse');
  const wh = await Warehouse.findById(id).catch(() => null);
  if (!wh || !wh.active) throw new ApiError(400, 'Selected warehouse was not found or is inactive');
  return wh;
};

const paymentOf = (order, input) => {
  const cod = input.paymentType === 'COD';
  return { type: cod ? 'COD' : 'PREPAID', codAmount: cod ? Number(input.codAmount || order.totalAmount) : 0 };
};

// ---------- 1. Compare rates (one or all configured couriers) ----------
exports.getRates = async (order, customer, input) => {
  requireCustomerAddress(customer);
  const wh = await loadWarehouse(input.warehouseId);
  const parcel = readParcel(input);
  const payment = paymentOf(order, input);

  const wanted = Array.isArray(input.providers) && input.providers.length
    ? input.providers.map(registry.getConfigured)
    : registry.configured();
  if (!wanted.length) throw new ApiError(503, 'No courier is configured. Add Xpressbees or Shipmozo keys in backend/.env');

  const q = {
    origin: wh.pincode, destination: customer.pincode, paymentType: payment.type,
    orderAmount: order.totalAmount, codAmount: payment.codAmount, ...parcel,
  };
  const results = await Promise.allSettled(wanted.map((p) => p.rates(q)));
  return wanted.map((p, i) => ({
    provider: p.id,
    label: p.displayName,
    autoHint: p.autoHint,
    couriers: results[i].status === 'fulfilled' ? results[i].value : [],
    error: results[i].status === 'rejected' ? results[i].reason.message : undefined,
  }));
};

// ---------- 2. Book shipment ----------
exports.book = async (order, customer, input, user) => {
  if (order.shipping?.status === 'booked') throw new ApiError(400, 'This order is already booked with a courier');
  const provider = registry.getConfigured(input.provider || registry.configured()[0]?.id);
  const warehouse = await loadWarehouse(input.warehouseId);
  const parcel = readParcel(input);
  const payment = paymentOf(order, input);

  const result = await provider.book({ order, customer, warehouse, parcel, payment, input, ref: refOf(order) });

  patchShipping(order, {
    status: 'booked',
    provider: provider.id,
    providerOrderId: result.providerOrderId,
    warehouseId: String(warehouse._id),
    weight: parcel.weight, length: parcel.length, width: parcel.width, height: parcel.height,
    paymentType: payment.type,
    codAmount: payment.codAmount || undefined,
    courierId: result.courierId,
    courierName: result.courierName,
    awb: result.awb,
    lrNumber: result.lrNumber,
    xbOrderId: result.xbOrderId,
    shipmentId: result.shipmentId,
    labelUrl: result.labelUrl,
    manifestUrl: result.manifestUrl,
    lastTrackStatus: undefined,
    lastTrackedAt: undefined,
    pushedAt: new Date(),
  });
  order.courier.partner = result.courierName;
  order.courier.awb = result.awb;
  order.courier.dispatchDate = order.courier.dispatchDate || new Date();
  if (BEFORE_READY.includes(order.status)) order.status = 'ready_for_dispatch';
  log(order, result.awb
    ? `Booked with ${provider.displayName} / ${result.courierName} (AWB ${result.awb})`
    : `Booked with ${provider.displayName} / ${result.courierName}. AWB is pending`, user._id);
  return { order: await order.save(), result: { ...result, provider: provider.id, providerLabel: provider.displayName } };
};

// ---------- 3. Track ----------
const mapTrackStatus = (text = '') => {
  const t = String(text).toLowerCase();
  if (/rto|return/.test(t)) return 'returned';
  if (/deliver/.test(t) && !/un|not|out for|attempt|pending/.test(t)) return 'delivered';
  if (/transit|picked|shipped|out for delivery|dispatch|reached|arrived/.test(t)) return 'in_transit';
  return null;
};

exports.track = async (order, user) => {
  requireBooked(order);
  const provider = providerOf(order);

  // Shipmozo can hand out the AWB a little after booking: fetch it now if we do not have it yet
  if (!order.shipping.awb && provider.syncAwb) {
    const found = await provider.syncAwb(order);
    if (found) {
      patchShipping(order, { awb: found.awb, lrNumber: found.lrNumber || order.shipping.lrNumber });
      order.courier.awb = found.awb;
      log(order, `AWB received from ${provider.displayName}: ${found.awb}`, user._id);
    }
  }
  const awb = requireAwb(order);

  const data = await provider.track(awb, order);
  const mapped = mapTrackStatus(data.status);
  patchShipping(order, { lastTrackStatus: data.status, lastTrackedAt: new Date() });

  if (mapped) order.courier.deliveryStatus = mapped;
  if (mapped === 'delivered' && !['delivered', 'invoice_generated', 'cancelled'].includes(order.status)) {
    order.status = 'delivered';
    log(order, 'Courier reports delivered', user._id);
  } else if (mapped === 'in_transit' && [...BEFORE_READY, 'ready_for_dispatch'].includes(order.status)) {
    order.status = 'dispatched';
    order.courier.dispatchStatus = 'dispatched';
    log(order, 'Courier picked up the shipment', user._id);
  }
  return { order: await order.save(), result: data };
};

// ---------- 4. Label + manifest ----------
exports.label = async (order) => {
  const awb = requireAwb(order);
  const label = await providerOf(order).label(order);
  return { awb, label, type: String(label).startsWith('data:') ? 'dataUrl' : 'url' };
};

exports.manifest = async (order, user) => {
  requireAwb(order);
  const provider = providerOf(order);
  if (!provider.manifest) throw new ApiError(400, `${provider.displayName} has no manifest API. Its pickup is handled by the courier`);
  const manifestUrl = await provider.manifest(order);
  if (manifestUrl) patchShipping(order, { manifestUrl });
  log(order, 'Manifest / pickup sheet generated', user._id);
  return { order: await order.save(), result: { manifest: manifestUrl } };
};

// ---------- 5. Cancel ----------
exports.cancel = async (order, user) => {
  const awb = requireAwb(order);
  const provider = providerOf(order);
  const data = await provider.cancel(order);
  patchShipping(order, {
    status: 'cancelled',
    attempts: (order.shipping.attempts || 0) + 1, // next booking uses a fresh order reference
    awb: undefined, lrNumber: undefined, courierId: undefined, courierName: undefined,
    labelUrl: undefined, manifestUrl: undefined, xbOrderId: undefined, shipmentId: undefined, providerOrderId: undefined,
  });
  order.courier.awb = undefined;
  order.courier.dispatchStatus = 'pending';
  order.courier.deliveryStatus = 'pending';
  log(order, `Shipment cancelled with ${provider.displayName} (AWB ${awb})`, user._id);
  return { order: await order.save(), result: data };
};

// ---------- 6. Return pickup ----------
exports.pushReturn = async (order, customer, input, user) => {
  requireBooked(order);
  const provider = providerOf(order);
  const warehouse = await Warehouse.findById(input.warehouseId || order.shipping.warehouseId).catch(() => null);
  if (!warehouse) throw new ApiError(400, 'Pickup warehouse of this shipment was not found. Add it again in Shipping > Warehouses');
  const result = await provider.pushReturn({ order, customer, warehouse, input, ref: order.shipping.providerOrderId || order.orderId });
  patchShipping(order, { returnPushed: true, returnAwb: result.returnAwb });
  log(order, `Return pickup created with ${provider.displayName}${result.returnAwb ? ` (AWB ${result.returnAwb})` : ''}`, user._id);
  return { order: await order.save(), result };
};

// ---------- 7. NDR action on one shipment (Ekart: Re-Attempt / RTO) ----------
exports.ndrAction = async (order, input, user) => {
  const awb = requireAwb(order);
  const provider = providerOf(order);
  if (!provider.ndrAction) throw new ApiError(400, `${provider.displayName} NDR actions are done from the NDR / Exceptions tab or its panel`);
  const result = await provider.ndrAction(order, input);
  log(order, `NDR action ${input.action} sent to ${provider.displayName} (AWB ${awb})`, user._id);
  return { order: await order.save(), result };
};
