const registry = require('./shipping');
const Warehouse = require('../models/Warehouse');
const ApiError = require('../utils/ApiError');
const { readParcel, requireCustomerAddress } = require('./shipping/common');
const tracking = require('./trackingService');
const { enrichCouriers, tagGroups, modeOf } = require('./shipping/rateMeta');

/**
 * Connects a CRM order to a courier platform (Xpressbees, Shipmozo, Ekart, Delhivery or Shiprocket; see services/shipping/).
 *   rates -> book (AWB) -> label / manifest / track / cancel / return
 * This file holds the courier-independent parts: validation, saving the result on order.shipping and the
 * status history. The courier-specific API calls live in the provider files.
 */

const BEFORE_READY = ['new_order', 'agent_assigned', 'confirmed'];

const { patchShipping } = tracking;
const log = (order, note, userId, auto = false) => tracking.log(order, note, { userId, auto });

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

// Values chosen while creating the order (payment, parcel size) are the defaults; the shipping form can override them.
const withDefaults = (order, input = {}) => {
  const saved = order.parcel?.toObject ? order.parcel.toObject() : order.parcel || {};
  const out = { ...input };
  ['weight', 'length', 'width', 'height'].forEach((k) => {
    if (out[k] === undefined || out[k] === '' || out[k] === null) out[k] = saved[k] || { weight: 500, length: 10, width: 10, height: 10 }[k];
  });
  if (!out.paymentType) out.paymentType = order.payment?.type;
  if (out.codAmount === undefined || out.codAmount === '') out.codAmount = order.payment?.codAmount;
  return out;
};

const paymentOf = (order, input) => {
  const cod = input.paymentType === 'COD';
  return { type: cod ? 'COD' : 'PREPAID', codAmount: cod ? Number(input.codAmount || order.totalAmount) : 0 };
};

// ---------- 1. Compare rates (one or all configured couriers) ----------
exports.getRates = async (order, customer, rawInput) => {
  const input = withDefaults(order, rawInput);
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
  return tagGroups(wanted.map((p, i) => ({
    provider: p.id,
    label: p.displayName,
    autoHint: p.autoHint,
    couriers: results[i].status === 'fulfilled' ? enrichCouriers(results[i].value) : [],
    error: results[i].status === 'rejected' ? results[i].reason.message : undefined,
  })));
};

// ---------- 2. Book shipment ----------
exports.book = async (order, customer, rawInput, user) => {
  const input = withDefaults(order, rawInput);
  if (order.shipping?.status === 'booked') throw new ApiError(400, 'This order is already booked with a courier');
  if (order.status !== 'confirmed') {
    throw new ApiError(400, ['new_order', 'agent_assigned'].includes(order.status)
      ? 'This order is not confirmed yet. Confirm it first, then ship it'
      : 'Only a confirmed order can be shipped');
  }
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
    mode: input.mode === 'air' || input.mode === 'surface' ? input.mode : modeOf({ name: result.courierName }),
    awb: result.awb,
    lrNumber: result.lrNumber,
    xbOrderId: result.xbOrderId,
    shipmentId: result.shipmentId,
    labelUrl: result.labelUrl,
    manifestUrl: result.manifestUrl,
    // Couriers without a manifest API (Shipmozo) schedule pickup themselves, so the parcel is ready for pickup at once
    manifestedAt: provider.capabilities?.manifest ? undefined : new Date(),
    lastTrackStatus: undefined,
    lastTrackedAt: undefined,
    trackHistory: [],
    ndr: undefined,
    pushedAt: new Date(),
  });
  order.courier.partner = result.courierName;
  order.courier.awb = result.awb;
  if (BEFORE_READY.includes(order.status)) order.status = 'ready_for_dispatch';
  log(order, result.awb
    ? `Booked with ${provider.displayName} / ${result.courierName} (AWB ${result.awb})`
    : `Booked with ${provider.displayName} / ${result.courierName}. AWB is pending`, user._id);
  return { order: await order.save(), result: { ...result, provider: provider.id, providerLabel: provider.displayName } };
};

// ---------- 3. Track (also used by the live background sync and webhooks) ----------
// `user` is null for automatic runs. The courier's status is mapped onto the CRM status in trackingService.
exports.track = async (order, user, { auto = false } = {}) => {
  requireBooked(order);
  const provider = providerOf(order);
  const uid = user?._id;

  // Shipmozo can hand out the AWB a little after booking: fetch it now if we do not have it yet
  if (!order.shipping.awb && provider.syncAwb) {
    const found = await provider.syncAwb(order);
    if (found) {
      patchShipping(order, { awb: found.awb, lrNumber: found.lrNumber || order.shipping.lrNumber });
      order.courier.awb = found.awb;
      log(order, `AWB received from ${provider.displayName}: ${found.awb}`, uid, auto);
    }
  }
  if (!order.shipping.awb) {
    if (auto) return { order: await order.save(), result: null }; // still waiting for the AWB, try again next round
    requireAwb(order);
  }

  const data = await provider.track(order.shipping.awb, order);
  await tracking.applyTracking(order, data, { userId: uid, auto });
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
  patchShipping(order, { manifestedAt: new Date(), ...(manifestUrl ? { manifestUrl } : {}) });
  log(order, 'Manifest / pickup sheet generated', user._id);
  return { order: await order.save(), result: { manifest: manifestUrl } };
};

// ---------- 5. Cancel ----------
exports.cancel = async (order, user) => {
  const awb = requireAwb(order);
  if (!['new_order', 'agent_assigned', 'confirmed', 'ready_for_dispatch'].includes(order.status)) {
    throw new ApiError(400, 'The courier has already picked this parcel up, so the shipment cannot be cancelled now');
  }
  const provider = providerOf(order);
  const data = await provider.cancel(order);
  patchShipping(order, {
    status: 'cancelled',
    attempts: (order.shipping.attempts || 0) + 1, // next booking uses a fresh order reference
    awb: undefined, lrNumber: undefined, courierId: undefined, courierName: undefined,
    labelUrl: undefined, manifestUrl: undefined, manifestedAt: undefined, xbOrderId: undefined, shipmentId: undefined, providerOrderId: undefined,
  });
  order.courier.awb = undefined;
  order.courier.partner = undefined;
  order.courier.deliveryStatus = 'pending';
  // Back to the step before booking, so the order can be shipped again
  if (order.status === 'ready_for_dispatch') order.status = 'confirmed';
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

// ---------- 7. NDR action on one shipment (re-attempt) ----------
// Ekart / Delhivery have a per-shipment NDR API. Xpressbees takes NDR actions through its own NDR endpoint.
// Shipmozo has no NDR API at all, so the re-attempt has to be requested in the Shipmozo panel.
const xbNdr = async (order, input, awb, provider) => {
  const items = [];
  const phone = String(input.phone || '').trim();
  const address = String(input.address || '').trim();
  if (phone) {
    if (!/^\d{10}$/.test(phone)) throw new ApiError(400, 'Phone must be 10 digits');
    items.push({ awb, action: 'change_phone', action_data: { phone } });
  }
  if (address) {
    items.push({ awb, action: 'change_address', action_data: { name: order.customer?.name || 'Customer', address_1: address, address_2: '' } });
  }
  if (!input.date) throw new ApiError(400, 'Choose the re-attempt date');
  items.push({ awb, action: 're-attempt', action_data: { re_attempt_date: String(input.date).slice(0, 10) } });
  const results = await provider.ndrCreate(items);
  const failed = (Array.isArray(results) ? results : []).filter((r) => r.status === false);
  if (failed.length) throw new ApiError(400, `Xpressbees: ${failed[0].message || 'NDR action failed'}`);
  return results;
};

exports.ndrAction = async (order, rawInput, user) => {
  const input = { ...rawInput, action: rawInput.action || 'Re-Attempt' };
  const awb = requireAwb(order);
  const provider = providerOf(order);
  if (input.action === 'RTO' && (provider.ndrAction || provider.id === 'xpressbees') && !provider.capabilities?.ndrRto) {
    throw new ApiError(400, `${provider.displayName} does not take a return-to-origin request from the CRM. Undelivered parcels return by themselves after the attempts`);
  }
  let result;
  if (provider.ndrAction) result = await provider.ndrAction(order, input);
  else if (provider.id === 'xpressbees' && provider.ndrCreate) result = await xbNdr(order, input, awb, provider);
  else throw new ApiError(400, `${provider.displayName} has no NDR API, so the CRM cannot send this. Ask for the re-attempt in the ${provider.displayName} panel`);

  const extra = [input.date && `on ${String(input.date).slice(0, 10)}`, input.phone && 'new phone', input.address && 'new address'].filter(Boolean).join(', ');
  log(order, `NDR ${input.action} requested from ${provider.displayName} (AWB ${awb})${extra ? `: ${extra}` : ''}${input.instructions ? `. Note: ${input.instructions}` : ''}`, user._id);
  patchShipping(order, { ndr: { ...(order.shipping?.ndr?.toObject?.() || order.shipping?.ndr || {}), lastAction: { action: input.action, date: input.date || null, by: String(user._id), at: new Date() } } });
  return { order: await order.save(), result };
};
