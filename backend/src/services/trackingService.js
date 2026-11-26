const Invoice = require('../models/Invoice');
const { mapCourierStatus, nextStatus } = require('./shipping/statusMap');

/**
 * Applies one tracking result (from a poll, the Track button or a courier webhook) to an order.
 * This is the single place that moves an order after booking, so the status is always the courier's truth.
 */

const patchShipping = (order, patch) => {
  const current = order.shipping?.toObject ? order.shipping.toObject() : order.shipping || {};
  order.shipping = { ...current, ...patch };
};

const log = (order, note, { userId, auto = false } = {}) => {
  order.statusHistory.push({ status: order.status, note, by: userId, auto });
};

const LABEL = {
  ready_for_dispatch: 'Ready for dispatch',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  ndr: 'Delivery attempt failed (NDR)',
  delivered: 'Delivered',
  rto: 'Returning to origin (RTO)',
  rto_delivered: 'Returned to origin',
};

/**
 * @param order  mongoose Order document
 * @param data   normalized track result { status, history, ndr }
 * @param opts   { userId, auto } who triggered it (auto = background sync / webhook)
 * @returns      { changed, from, to }
 */
exports.applyTracking = async (order, data, { userId, auto = false } = {}) => {
  const from = order.status;
  const mapped = mapCourierStatus(data.status);
  const events = (Array.isArray(data.history) ? data.history : []).slice(0, 60).map((h) => ({
    message: h.message, location: h.location, time: h.time,
  }));

  patchShipping(order, {
    lastTrackStatus: data.status || order.shipping?.lastTrackStatus,
    lastTrackedAt: new Date(),
    ...(events.length ? { trackHistory: events } : {}),
    ndr: data.ndr || undefined,
  });

  let to = nextStatus(from, mapped);

  // The courier cancelled the booking on its side while we were waiting for pickup: free the order for rebooking
  if (to === 'cancelled_by_courier') {
    patchShipping(order, {
      status: 'cancelled', attempts: (order.shipping.attempts || 0) + 1,
      awb: undefined, lrNumber: undefined, courierId: undefined, courierName: undefined,
      labelUrl: undefined, manifestUrl: undefined, manifestedAt: undefined, xbOrderId: undefined, shipmentId: undefined, providerOrderId: undefined,
    });
    order.courier.awb = undefined;
    order.courier.deliveryStatus = 'pending';
    to = 'confirmed'; // it was confirmed before it was booked, so it goes back to "confirmed" and can be shipped again
    order.status = to;
    log(order, `Shipment was cancelled by the courier (${data.status}). Book it again`, { userId, auto });
    return { changed: true, from, to };
  }

  // Delivered after an invoice already exists -> straight to "invoice generated"
  if (to === 'delivered' && order._id && (await Invoice.exists({ order: order._id }).catch(() => null))) to = 'invoice_generated';

  if (mapped) {
    order.courier.deliveryStatus = { in_transit: 'in_transit', out_for_delivery: 'in_transit', delivered: 'delivered', rto: 'returned', rto_delivered: 'returned' }[mapped] || order.courier.deliveryStatus;
  }
  if (!order.courier.dispatchDate && ['in_transit', 'out_for_delivery', 'delivered'].includes(to)) order.courier.dispatchDate = new Date();

  if (to !== from) {
    order.status = to;
    log(order, `${LABEL[to] || to}${data.status ? ` · Courier: ${data.status}` : ''}`, { userId, auto });
    return { changed: true, from, to };
  }
  return { changed: false, from, to };
};

exports.patchShipping = patchShipping;
exports.log = log;
