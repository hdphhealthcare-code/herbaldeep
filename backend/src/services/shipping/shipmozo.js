const api = require('../shipmozoApi');
const client = require('../shipmozoClient');
const ApiError = require('../../utils/ApiError');
const { digits, optional, pick, deepFind, requireCustomerAddress, cheapest } = require('./common');

/**
 * Shipmozo provider.
 * Flow: warehouse (auto-created on the panel) -> push-order -> rate-calculator -> assign-courier
 *       -> schedule-pickup (when the courier does not auto-schedule) -> AWB -> label / track / cancel / return
 * Shipmozo has no manifest, courier-list or NDR API.
 */

const AWB_KEYS = ['awb_number', 'awb', 'awbNumber', 'tracking_number', 'waybill_number'];
const DUPLICATE = /already|exist|duplicate/i; // makes retries safe when a previous attempt got part-way

// The rate-calculator response shape is not fixed in the docs, so read the common field names defensively.
const toNumberIfNumeric = (v) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : v);
const normalizeCouriers = (data) => {
  const list = Array.isArray(data) ? data : data?.couriers || data?.rates || data?.courier_list || data?.data || [];
  return (Array.isArray(list) ? list : []).map((c) => ({
    id: String(pick(c, ['courier_id', 'id', 'courierId']) ?? ''),
    name: pick(c, ['name', 'courier_name', 'courier', 'courier_company', 'company_name']) || 'Courier',
    service: pick(c, ['service', 'courier_company_service', 'service_type', 'mode']),
    rate: toNumberIfNumeric(pick(c, ['total_charges', 'total_charge', 'rate', 'charge', 'freight_charges', 'total', 'price'])),
    eta: pick(c, ['estimated_delivery', 'expected_delivery_date', 'etd', 'delivery_time', 'tat']),
    rating: pick(c, ['rating', 'courier_rating', 'avg_rating', 'average_rating', 'delivery_rating', 'performance_rating']),
    chargeableWeight: pick(c, ['chargeable_weight', 'applicable_weight']),
    autoPickup: String(pick(c, ['pickups_automatically_scheduled']) || '').toUpperCase() === 'YES',
  }));
};

const rateQuery = (q) => ({
  order_id: q.orderRef || '',
  pickup_pincode: Number(q.origin),
  delivery_pincode: Number(q.destination),
  payment_type: q.paymentType === 'COD' ? 'COD' : 'PREPAID',
  shipment_type: q.shipmentType || 'FORWARD',
  order_amount: Number(q.orderAmount),
  type_of_package: 'SPS',
  rov_type: 'ROV_OWNER',
  cod_amount: q.paymentType === 'COD' ? String(q.codAmount || q.orderAmount) : '',
  weight: Number(q.weight),
  dimensions: [{ no_of_box: '1', length: String(q.length), width: String(q.width), height: String(q.height) }],
});

// Shipmozo identifies pickup locations by warehouse_id. Create it once from our own warehouse and remember the id.
async function ensureWarehouse(wh) {
  const existing = wh.providerIds?.shipmozo;
  if (existing) return String(existing);
  const data = await api.createWarehouse({
    address_title: wh.title,
    name: wh.name,
    phone: Number(digits(wh.phone)),
    email: optional(wh.email),
    address_line_one: wh.address,
    address_line_two: optional(wh.address2),
    pin_code: Number(wh.pincode),
  });
  if (!data?.warehouse_id) throw new ApiError(502, 'Shipmozo did not return a warehouse_id');
  wh.providerIds = { ...(wh.providerIds || {}), shipmozo: String(data.warehouse_id) };
  if (wh.markModified) wh.markModified('providerIds');
  if (wh.save) await wh.save();
  return String(data.warehouse_id);
}

const products = (order) => order.items.map((i) => ({
  name: i.name, sku_number: i.sku, quantity: i.quantity, discount: '', hsn: '', unit_price: i.price, product_category: 'Other',
}));

const ignoreDuplicate = async (fn) => {
  try { return await fn(); } catch (err) { if (DUPLICATE.test(err.message)) return null; throw err; }
};

async function awbFromDetail(ref) {
  const detail = await api.getOrderDetail(ref).catch(() => null);
  return { awb: deepFind(detail, AWB_KEYS), lr: deepFind(detail, ['lr_number', 'lr']) };
}

// Gets the AWB after a courier is assigned: schedule pickup when the courier does not auto-schedule, else read the order.
async function resolveAwb(ref, autoPickup) {
  const schedule = async () => {
    const p = await api.schedulePickup(ref);
    return { awb: p.awb_number, lr: p.lr_number };
  };
  if (!autoPickup) {
    try { return await schedule(); } catch (err) {
      const fromDetail = await awbFromDetail(ref);
      if (fromDetail.awb) return fromDetail;
      throw err;
    }
  }
  const fromDetail = await awbFromDetail(ref);
  if (fromDetail.awb) return fromDetail;
  return schedule().catch(() => ({})); // AWB can still be pending; Track shipment fetches it later
}

module.exports = {
  id: 'shipmozo',
  displayName: 'Shipmozo',
  autoHint: 'Shipmozo books the cheapest available courier',
  capabilities: { manifest: false, ndr: false, ndrAction: false, returnReasons: true, courierList: false },

  isConfigured: client.isConfigured,

  async status() {
    if (!client.isConfigured()) return { configured: false, online: false, message: 'Shipmozo public / private key not set in backend/.env' };
    try {
      const list = await api.getWarehouses(); // needs valid keys, so it proves they work
      return { configured: true, online: true, message: `Keys valid. ${Array.isArray(list) ? list.length : 0} warehouse(s) on the Shipmozo panel.` };
    } catch (err) {
      return { configured: true, online: false, message: err.message };
    }
  },

  async rates(q) {
    return normalizeCouriers(await api.rateCalculator(rateQuery(q)));
  },

  async serviceability({ origin, destination }) {
    const data = await api.pincodeServiceability(origin, destination);
    return { serviceable: data?.serviceable === true || String(data?.serviceable).toLowerCase() === 'true', couriers: [] };
  },

  async book({ order, customer, warehouse, parcel, payment, input, ref }) {
    requireCustomerAddress(customer);
    const warehouseId = await ensureWarehouse(warehouse);

    await ignoreDuplicate(() => api.pushOrder({
      order_id: ref,
      order_date: new Date(order.orderDate).toISOString().slice(0, 10),
      order_type: input.orderType || 'ESSENTIALS',
      consignee_name: customer.name,
      consignee_phone: Number(digits(customer.mobile)),
      consignee_email: optional(customer.email),
      consignee_address_line_one: customer.address,
      consignee_address_line_two: optional(customer.area),
      consignee_pin_code: Number(customer.pincode),
      consignee_city: customer.city,
      consignee_state: customer.state,
      product_detail: products(order),
      payment_type: payment.type,
      cod_amount: payment.type === 'COD' ? String(payment.codAmount) : '',
      weight: parcel.weight,
      length: parcel.length,
      width: parcel.width,
      height: parcel.height,
      warehouse_id: warehouseId,
      gst_ewaybill_number: input.gstEwaybillNumber || '',
      gstin_number: input.gstinNumber || '',
    }));

    const rates = normalizeCouriers(await api.rateCalculator(rateQuery({
      orderRef: ref, origin: warehouse.pincode, destination: customer.pincode, paymentType: payment.type,
      orderAmount: order.totalAmount, codAmount: payment.codAmount, ...parcel,
    })));
    if (!rates.length) throw new ApiError(400, 'Shipmozo: no courier is available for this route');
    const chosen = input.courierId ? rates.find((c) => c.id === String(input.courierId)) : cheapest(rates);
    if (!chosen) throw new ApiError(400, 'The selected Shipmozo courier is no longer available. Compare rates again');

    const assigned = await ignoreDuplicate(() => api.assignCourier(ref, Number(chosen.id) || chosen.id));
    const { awb, lr } = await resolveAwb(ref, chosen.autoPickup);

    return {
      awb,
      courierId: chosen.id,
      courierName: assigned?.courier || chosen.name,
      providerOrderId: ref,
      lrNumber: lr,
      raw: assigned,
    };
  },

  // Shipmozo may hand out the AWB a little after assignment; Track shipment calls this when we do not have it yet.
  async syncAwb(order) {
    const { awb, lr } = await awbFromDetail(order.shipping.providerOrderId || order.orderId);
    return awb ? { awb, lrNumber: lr } : null;
  },

  async track(awb) {
    const data = await api.trackOrder(awb);
    const scans = Array.isArray(data.scan_detail) ? data.scan_detail : [];
    return {
      awb: data.awb_number || awb,
      status: data.current_status,
      history: scans.map((h) => ({
        message: pick(h, ['status', 'remark', 'remarks', 'activity', 'description', 'message', 'scan']),
        location: pick(h, ['location', 'city']),
        time: pick(h, ['time', 'datetime', 'date', 'status_time', 'scan_time', 'created_at']),
      })),
      raw: data,
    };
  },

  async label(order) {
    const data = await api.getOrderLabel(order.shipping.awb);
    const label = Array.isArray(data) ? data[0]?.label : data?.label;
    if (!label) throw new ApiError(404, 'Shipmozo has no label for this AWB yet');
    return label; // base64 data URL (png)
  },

  async cancel(order) {
    return api.cancelOrder(order.shipping.providerOrderId || order.orderId, order.shipping.awb);
  },

  async returnReasons() {
    return api.getReturnReasons();
  },

  async pushReturn({ order, customer, warehouse, input, ref }) {
    requireCustomerAddress(customer);
    if (!input.returnReasonId) throw new ApiError(400, 'Select a return reason');
    const returnRef = `${ref}-R`;
    const s = order.shipping || {};
    const weightKg = Number(input.weight) || Math.max((s.weight || 500) / 1000, 0.1); // return API takes kg
    const dims = { length: Number(input.length) || s.length || 10, width: Number(input.width) || s.width || 10, height: Number(input.height) || s.height || 10 };
    const warehouseId = warehouse ? await ensureWarehouse(warehouse) : '';

    const data = await api.pushReturnOrder({
      order_id: returnRef,
      order_date: new Date(order.orderDate).toISOString().slice(0, 10),
      order_type: input.orderType || 'ESSENTIALS',
      pickup_name: customer.name,
      pickup_phone: Number(digits(customer.mobile)),
      pickup_email: optional(customer.email),
      pickup_address_line_one: customer.address,
      pickup_address_line_two: optional(customer.area),
      pickup_pin_code: Number(customer.pincode),
      pickup_city: customer.city,
      pickup_state: customer.state,
      product_detail: products(order),
      payment_type: 'PREPAID',
      weight: weightKg,
      ...dims,
      warehouse_id: warehouseId,
      return_reason_id: Number(input.returnReasonId),
      customer_request: input.customerRequest || 'REFUND',
      reason_comment: input.reasonComment || '',
    });

    // Best effort: also pick the cheapest courier for the return (the rate API supports shipment_type RETURN)
    let note = '';
    let returnAwb = data?.awb_number;
    try {
      const rates = normalizeCouriers(await api.rateCalculator(rateQuery({
        orderRef: returnRef, shipmentType: 'RETURN', origin: customer.pincode, destination: warehouse?.pincode || s.pickupPincode,
        paymentType: 'PREPAID', orderAmount: order.totalAmount, weight: Math.round(weightKg * 1000), ...dims,
      })));
      const chosen = cheapest(rates);
      if (chosen) {
        await ignoreDuplicate(() => api.assignCourier(returnRef, Number(chosen.id) || chosen.id));
        const resolved = await resolveAwb(returnRef, chosen.autoPickup).catch(() => ({}));
        returnAwb = returnAwb || resolved.awb;
      } else {
        note = 'Return order created. Assign its courier from the Shipmozo panel';
      }
    } catch (err) {
      note = `Return order created, but courier was not assigned (${err.message}). Assign it from the Shipmozo panel`;
    }
    return { returnAwb, note, raw: data };
  },
};
