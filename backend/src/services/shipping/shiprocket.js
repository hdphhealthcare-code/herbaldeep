const api = require('../shiprocketApi');
const client = require('../shiprocketClient');
const { shiprocket: cfg } = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const { mapCourierStatus } = require('./statusMap');
const { digits, optional, requireCustomerAddress, deepFind } = require('./common');

/**
 * Shiprocket provider (API v1 external, email + password login).
 * Flow: serviceability (couriers + rates) -> pickup address registered once (nickname = warehouse title)
 *       -> create order (gives shipment_id) -> assign AWB with the chosen courier (courier_id) -> label (PDF url) /
 *       manifest + pickup / track / cancel / NDR action (re-attempt, return)
 * Unlike Delhivery / Ekart, Shiprocket has a real courier list: every row on the ship page is one courier company.
 */
const num = (v) => (v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined);
const round2 = (n) => Math.round(n * 100) / 100;
const kgOf = (grams) => Math.max(Math.round((Number(grams) || 0)) / 1000, 0.01);

const modeOf = (c) => {
  if (typeof c.is_surface === 'boolean') return c.is_surface ? 'surface' : 'air';
  if (String(c.mode ?? '').match(/air/i)) return 'air';
  return undefined; // rateMeta guesses from the courier name
};

const normalize = (list) => (Array.isArray(list) ? list : []).map((c) => {
  const days = num(c.estimated_delivery_days);
  return {
    id: String(c.courier_company_id ?? c.id ?? ''),
    name: c.courier_name || 'Courier',
    rate: num(c.rate ?? c.freight_charge),
    freight: num(c.freight_charge),
    cod: num(c.cod_charges) || undefined,
    rating: c.rating ?? c.courier_rating,
    eta: days ? `${days} day${days === 1 ? '' : 's'}` : c.etd || undefined,
    mode: modeOf(c),
  };
}).filter((c) => c.id);

async function fetchCouriers(q) {
  const cod = q.paymentType === 'COD';
  const out = await api.serviceability({
    pickup_postcode: String(q.origin),
    delivery_postcode: String(q.destination),
    weight: kgOf(q.weight),
    cod: cod ? 1 : 0,
    declared_value: Math.max(Math.round(Number(q.orderAmount) || 0), 1),
    length: q.length, breadth: q.width, height: q.height,
  });
  const list = out.json?.data?.available_courier_companies;
  if (!out.ok || !Array.isArray(list) || !list.length) {
    const why = client.failureMessage(out.json, { status: out.status });
    throw new ApiError(400, `Shiprocket: ${out.ok || out.status === 404 ? (out.json?.message || 'no courier serves this route') : why}`);
  }
  return normalize(list);
}

// Pickup addresses are registered with Shiprocket by a nickname. Reuse one with our warehouse title, else register it once.
async function ensurePickup(wh) {
  if (wh.providerIds?.shiprocket) return String(wh.providerIds.shiprocket);
  const nickname = String(wh.title).slice(0, 36);
  const list = await api.pickupLocations();
  const found = (list?.data?.shipping_address || []).find((a) => String(a.pickup_location).toLowerCase() === nickname.toLowerCase());
  let name = found?.pickup_location;
  if (!name) {
    await api.addPickup({
      pickup_location: nickname,
      name: wh.name,
      email: optional(wh.email) || cfg.pickupEmail || cfg.email,
      phone: digits(wh.phone),
      address: wh.address,
      address_2: optional(wh.address2) || '',
      city: wh.city,
      state: wh.state,
      country: 'India',
      pin_code: String(wh.pincode),
    });
    name = nickname;
  }
  wh.providerIds = { ...(wh.providerIds || {}), shiprocket: String(name) };
  if (wh.markModified) wh.markModified('providerIds');
  if (wh.save) await wh.save();
  return String(name);
}

// "YYYY-MM-DD HH:mm" in Indian time, as Shiprocket wants it
const orderDateOf = (d) => new Date(new Date(d || Date.now()).getTime() + 330 * 60000).toISOString().slice(0, 16).replace('T', ' ');

const orderBody = ({ order, customer, pickup, parcel, payment, ref }) => {
  const items = order.items.map((i) => ({
    name: i.name,
    sku: i.sku || i.name,
    units: i.quantity,
    selling_price: round2((i.lineTotal || i.price * i.quantity) / i.quantity), // per unit, after discount, GST included
    discount: '',
    tax: '',
    hsn: cfg.hsnCode || '',
  }));
  const itemsTotal = round2(items.reduce((n, i) => n + i.selling_price * i.units, 0));
  // Shiprocket collects sub_total + shipping_charges - total_discount on COD: this is how a custom COD amount is honoured
  const diff = payment.type === 'COD' ? round2(payment.codAmount - itemsTotal) : 0;
  return {
    order_id: ref,
    order_date: orderDateOf(order.orderDate),
    pickup_location: pickup,
    comment: String(order.notes || '').slice(0, 250),
    billing_customer_name: customer.name,
    billing_last_name: '',
    billing_address: [customer.address, optional(customer.area)].filter(Boolean).join(', '),
    billing_address_2: '',
    billing_city: customer.city,
    billing_pincode: String(customer.pincode),
    billing_state: customer.state,
    billing_country: 'India',
    billing_email: optional(customer.email) || cfg.customerEmail || cfg.pickupEmail || cfg.email,
    billing_phone: digits(customer.mobile),
    shipping_is_billing: true,
    order_items: items,
    payment_method: payment.type === 'COD' ? 'COD' : 'Prepaid',
    shipping_charges: diff > 0 ? diff : 0,
    giftwrap_charges: 0,
    transaction_charges: 0,
    total_discount: diff < 0 ? -diff : 0,
    sub_total: itemsTotal,
    length: parcel.length,
    breadth: parcel.width,
    height: parcel.height,
    weight: kgOf(parcel.weight),
  };
};

const cancelQuietly = (orderId) => (orderId ? api.cancelOrders([orderId]).catch(() => null) : null);

module.exports = {
  id: 'shiprocket',
  displayName: 'Shiprocket',
  autoHint: 'Shiprocket assigns the best courier on your account',
  // manifest = pickup request + manifest PDF. ndrAction = re-attempt / return. No return-reason list.
  capabilities: { manifest: true, ndr: false, ndrAction: true, ndrRto: true, returnReasons: false, courierList: false, returns: false },

  isConfigured: client.isConfigured,

  async status() {
    if (!client.isConfigured()) return { configured: false, online: false, message: 'Shiprocket email / password not set in backend/.env (SHIPROCKET_EMAIL, SHIPROCKET_PASSWORD)' };
    try {
      await api.ping();
      const list = await api.pickupLocations().catch(() => null);
      const n = list?.data?.shipping_address?.length;
      return { configured: true, online: true, message: `Login OK. Token is refreshed automatically.${Number.isFinite(n) ? ` ${n} pickup address(es) registered.` : ''}` };
    } catch (err) {
      return { configured: true, online: false, message: err.message };
    }
  },

  rates: (q) => fetchCouriers(q),

  async serviceability({ origin, destination }) {
    try {
      const couriers = await fetchCouriers({ origin, destination, paymentType: 'PREPAID', orderAmount: 500, weight: 500, length: 10, width: 10, height: 10 });
      return { serviceable: couriers.length > 0, couriers };
    } catch (err) {
      if (err.statusCode === 400 || err.status === 400) return { serviceable: false, couriers: [], reason: err.message };
      throw err;
    }
  },

  async book({ order, customer, warehouse, parcel, payment, input, ref }) {
    requireCustomerAddress(customer);
    const pickup = await ensurePickup(warehouse);
    const created = await api.createOrder(orderBody({ order, customer, pickup, parcel, payment, ref }));
    const shipmentId = created?.shipment_id;
    const srOrderId = created?.order_id;
    if (!shipmentId) throw new ApiError(400, `Shiprocket: ${client.failureMessage(created, { status: 200 })}`);

    let assigned;
    try {
      assigned = await api.assignAwb({ shipment_id: shipmentId, ...(input.courierId ? { courier_id: Number(input.courierId) } : {}) });
    } catch (err) {
      await cancelQuietly(srOrderId); // no half-made order left in the Shiprocket panel
      throw err;
    }
    const awb = deepFind(assigned, ['awb_code'], 4);
    if (!awb || assigned?.awb_assign_status === 0) {
      await cancelQuietly(srOrderId);
      const why = assigned?.message || deepFind(assigned, ['awb_assign_error', 'message'], 4) || 'could not assign a courier. Check your Shiprocket wallet balance';
      throw new ApiError(400, `Shiprocket: ${why}`);
    }
    const courierName = deepFind(assigned, ['courier_name'], 4) || 'Shiprocket';
    return {
      awb: String(awb),
      courierId: String(deepFind(assigned, ['courier_company_id'], 4) || input.courierId || ''),
      courierName,
      providerOrderId: ref,
      xbOrderId: srOrderId ? String(srOrderId) : undefined, // Shiprocket's own order id (needed to cancel the order)
      shipmentId: String(shipmentId),
      raw: assigned,
    };
  },

  async track(awb) {
    const out = await api.track(awb);
    const td = out.json?.tracking_data || {};
    const acts = Array.isArray(td.shipment_track_activities) ? td.shipment_track_activities : [];
    const st = Array.isArray(td.shipment_track) ? td.shipment_track[0] : null;
    if (!st && !acts.length) throw new ApiError(404, `Shiprocket has no tracking data for AWB ${awb} yet${td.error ? `: ${td.error}` : ''}`);
    const status = st?.current_status || acts[0]?.['sr-status-label'] || acts[0]?.activity || '';
    const history = acts.map((x) => ({
      message: [x['sr-status-label'], x.activity].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' - '),
      location: x.location,
      time: x.date,
    }));
    return {
      awb: st?.awb_code || awb,
      status,
      history: history.length ? history : [{ message: status, location: st?.current_location, time: st?.updated_time_stamp }],
      ndr: mapCourierStatus(status) === 'ndr' ? { status: acts[0]?.activity || 'Delivery failed', actions: ['Re-Attempt', 'RTO'] } : undefined,
      raw: out.json,
    };
  },

  async label(order) {
    if (!order.shipping.shipmentId) throw new ApiError(404, 'This shipment has no Shiprocket shipment id, so there is no courier label');
    const r = await api.label([Number(order.shipping.shipmentId)]);
    const url = r?.label_url || deepFind(r, ['label_url'], 3);
    if (!url) throw new ApiError(404, `Shiprocket did not return a label${r?.message ? `: ${r.message}` : ''}. Use the CRM label (4x6) instead`);
    return String(url);
  },

  // "Manifest" = ask for the pickup (Shiprocket may already have scheduled it) and fetch the manifest PDF
  async manifest(order) {
    const ids = [Number(order.shipping.shipmentId)];
    try {
      await api.generatePickup(ids);
    } catch (err) {
      if (!/already|schedul|exist|generated/i.test(err.message)) throw err; // pickup is already requested: fine
    }
    const r = await api.manifest(ids);
    const url = r?.manifest_url || deepFind(r, ['manifest_url'], 3);
    if (!url) throw new ApiError(502, `Shiprocket did not return a manifest link${r?.message ? `: ${r.message}` : ''}`);
    return String(url);
  },

  async cancel(order) {
    const data = await api.cancelAwbs([order.shipping.awb]);
    await cancelQuietly(order.shipping.xbOrderId ? Number(order.shipping.xbOrderId) : undefined);
    return data;
  },

  async pushReturn() {
    throw new ApiError(400, 'Return pickup with Shiprocket is not available from the CRM yet. Create the return from the Shiprocket panel');
  },

  async ndrAction(order, input) {
    if (!['Re-Attempt', 'RTO'].includes(input.action)) throw new ApiError(400, 'Action must be Re-Attempt or RTO');
    const body = { action: input.action === 'RTO' ? 'return' : 're-attempt', comments: String(input.instructions || 'Requested from the CRM').slice(0, 200) };
    if (input.action === 'Re-Attempt') {
      if (!input.date) throw new ApiError(400, 'Choose the re-attempt date');
      body.deferred_date = String(input.date).slice(0, 10);
    }
    if (input.phone) {
      if (!/^\d{10}$/.test(String(input.phone))) throw new ApiError(400, 'Phone must be 10 digits');
      body.phone = String(input.phone);
    }
    if (input.address) body.address1 = String(input.address);
    return api.ndr(order.shipping.awb, body);
  },
};
