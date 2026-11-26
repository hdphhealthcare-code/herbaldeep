const api = require('../xpressbeesApi');
const client = require('../xpressbeesClient');
const ApiError = require('../../utils/ApiError');
const { digits, optional, str, requireCustomerAddress } = require('./common');

/**
 * Xpressbees provider.
 * Flow: serviceability (rates) -> shipments2 (booking = AWB + label + manifest in one call)
 * Pickup address is sent with each booking (no warehouse API).
 */

const pickupBlock = (wh) => ({
  warehouse_name: wh.title,
  name: wh.name,
  address: wh.address,
  address_2: wh.address2 || '',
  city: wh.city,
  state: wh.state,
  pincode: String(wh.pincode),
  phone: digits(wh.phone),
});

const normalizeCouriers = (list) => (Array.isArray(list) ? list : []).map((c) => ({
  id: c.id != null ? String(c.id) : '',
  name: c.name || 'Courier',
  rate: c.total_charges,
  freight: c.freight_charges,
  cod: c.cod_charges,
  chargeableWeight: c.chargeable_weight,
  minWeight: c.min_weight,
  rating: c.rating ?? c.courier_rating,
  eta: c.estimated_delivery ?? c.etd ?? c.tat,
}));

const rateQuery = (q) => ({
  origin: String(q.origin),
  destination: String(q.destination),
  payment_type: q.paymentType === 'COD' ? 'cod' : 'prepaid',
  order_amount: str(q.orderAmount),
  weight: str(q.weight),
  length: str(q.length),
  breadth: str(q.width),
  height: str(q.height),
});

// weight -> Xpressbees track status text -> CRM mapping happens in orderShippingService
module.exports = {
  id: 'xpressbees',
  displayName: 'Xpressbees',
  autoHint: 'Xpressbees picks the courier by your account rules',
  capabilities: { manifest: true, ndr: true, ndrAction: false, returnReasons: false, courierList: true },

  isConfigured: client.isConfigured,

  async status() {
    if (!client.isConfigured()) return { configured: false, online: false, message: 'Xpressbees email / password not set in backend/.env' };
    try {
      await api.ping();
      return { configured: true, online: true, message: 'Login OK. Token is refreshed automatically.' };
    } catch (err) {
      return { configured: true, online: false, message: err.message };
    }
  },

  async couriers() {
    return (await api.courierList()).map((c) => ({ id: String(c.id), name: c.name }));
  },

  async rates(q) {
    return normalizeCouriers(await api.serviceability(rateQuery(q)));
  },

  async serviceability({ origin, destination }) {
    const couriers = normalizeCouriers(await api.serviceability(rateQuery({
      origin, destination, paymentType: 'PREPAID', orderAmount: 500, weight: 500, length: 10, width: 10, height: 10,
    })));
    return { serviceable: couriers.length > 0, couriers };
  },

  async book({ order, customer, warehouse, parcel, payment, input }) {
    requireCustomerAddress(customer);
    const payload = {
      order_number: order.orderId,
      unique_order_number: 'no', // 'no' so a cancelled order can be booked again with the same number
      shipping_charges: 0,
      discount: 0,
      cod_charges: 0,
      payment_type: payment.type === 'COD' ? 'cod' : 'prepaid',
      order_amount: order.totalAmount,
      package_weight: parcel.weight,
      package_length: parcel.length,
      package_breadth: parcel.width,
      package_height: parcel.height,
      request_auto_pickup: input.autoPickup === false ? 'no' : 'yes',
      consignee: {
        name: customer.name,
        address: customer.address,
        address_2: optional(customer.area) || '',
        city: customer.city,
        state: customer.state,
        pincode: String(customer.pincode),
        phone: digits(customer.mobile),
      },
      pickup: pickupBlock(warehouse),
      is_rto_different: 'no',
      order_items: order.items.map((i) => ({ name: i.name, qty: String(i.quantity), price: String(i.price), sku: i.sku || '' })),
      courier_id: str(input.courierId), // blank = Xpressbees decides
      collectable_amount: String(payment.type === 'COD' ? payment.codAmount : 0),
    };
    const data = await api.book(payload);
    return {
      awb: data.awb_number,
      courierId: data.courier_id !== undefined ? String(data.courier_id) : undefined,
      courierName: data.courier_name,
      providerOrderId: order.orderId,
      xbOrderId: data.order_id !== undefined ? String(data.order_id) : undefined,
      shipmentId: data.shipment_id !== undefined ? String(data.shipment_id) : undefined,
      labelUrl: data.label,
      manifestUrl: data.manifest,
      raw: data,
    };
  },

  async track(awb) {
    const data = await api.track(awb);
    return {
      awb: data.awb_number || awb,
      status: data.status,
      history: (Array.isArray(data.history) ? data.history : []).map((h) => ({
        message: h.message || h.status_code, location: h.location, time: h.event_time,
      })),
      raw: data,
    };
  },

  async label(order) {
    if (!order.shipping.labelUrl) throw new ApiError(404, 'Label is not available for this shipment');
    return order.shipping.labelUrl;
  },

  async manifest(order) {
    const url = await api.manifest([order.shipping.awb]);
    return (typeof url === 'string' ? url : url?.manifest || url?.url) || order.shipping.manifestUrl;
  },

  async cancel(order) {
    return api.cancel(order.shipping.awb);
  },

  async pushReturn({ order, customer, warehouse, input }) {
    requireCustomerAddress(customer);
    const first = order.items[0];
    const qty = order.items.reduce((n, i) => n + i.quantity, 0);
    const data = await api.reverseBook({
      order_id: `${order.orderId}-R`,
      request_auto_pickup: 'yes',
      consignee: {
        name: customer.name,
        address: customer.address,
        address_2: optional(customer.area) || '',
        city: customer.city,
        state: customer.state,
        pincode: String(customer.pincode),
        phone: digits(customer.mobile),
        alternate_phone: digits(customer.mobile),
      },
      pickup: pickupBlock(warehouse),
      categories: input.category || 'Healthcare',
      product_name: order.items.length > 1 ? `${first.name} + ${order.items.length - 1} more` : first.name,
      product_qty: String(qty),
      product_amount: String(order.totalAmount),
      package_weight: Number(input.weight) || order.shipping?.weight || 500, // grams
      package_length: String(Number(input.length) || order.shipping?.length || 10),
      package_breadth: String(Number(input.width) || order.shipping?.width || 10),
      package_height: String(Number(input.height) || order.shipping?.height || 10),
      qccheck: '0',
    });
    return { returnAwb: data.awb_number, raw: data };
  },

  // NDR / exceptions (Xpressbees only)
  ndrList: () => api.ndrList(),
  ndrCreate: (items) => api.ndrCreate(items),
};
