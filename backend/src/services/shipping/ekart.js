const api = require('../ekartApi');
const client = require('../ekartClient');
const { ekart: cfg } = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const Invoice = require('../../models/Invoice');
const { digits, optional, requireCustomerAddress, cheapest } = require('./common');

/**
 * Ekart provider.
 * Flow: pickup address registered once (Address API, alias = our warehouse title) -> serviceability (rates for SURFACE / EXPRESS)
 *       -> package/create (tracking_id = AWB) -> label (PDF) / manifest / track / cancel / reverse pickup / NDR action
 * Ekart has no courier list API: the choice is the service, SURFACE or EXPRESS.
 */

const SERVICES = [{ id: 'SURFACE', name: 'Ekart Surface' }, { id: 'EXPRESS', name: 'Ekart Express' }];
const COD_LIMIT = 49999;
const round2 = (n) => Math.round(n * 100) / 100;
const num = (v) => (v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined);
const ymd = (d) => new Date(d).toISOString().slice(0, 10);
const serviceOf = (id) => (String(id).toUpperCase() === 'EXPRESS' ? 'EXPRESS' : 'SURFACE');
const serviceName = (id) => SERVICES.find((s) => s.id === id).name;

const sellerDetails = () => {
  const missing = [
    !cfg.sellerName && 'EKART_SELLER_NAME',
    !cfg.sellerAddress && 'EKART_SELLER_ADDRESS',
    !cfg.sellerGstTin && 'EKART_SELLER_GST_TIN',
  ].filter(Boolean);
  if (missing.length) throw new ApiError(503, `Ekart needs the seller details in backend/.env: ${missing.join(', ')}`);
  return { seller_name: cfg.sellerName, seller_address: cfg.sellerAddress, seller_gst_tin: cfg.sellerGstTin };
};

const rateEntry = (service, e) => ({
  id: service.id,
  name: service.name,
  service: e.courierGroup,
  rate: num(e.forwardDeliveredCharges?.totalForwardDeliveredEstimate),
  freight: num(e.forwardDeliveredCharges?.forwardFreight),
  cod: num(e.forwardDeliveredCharges?.codCharges),
  eta: e.tat ? `${e.tat.min}-${e.tat.max} days` : undefined,
});

async function quote(q, service) {
  const cod = q.paymentType === 'COD';
  const list = await api.serviceability({
    pickupPincode: String(q.origin), dropPincode: String(q.destination),
    length: String(q.length), height: String(q.height), width: String(q.width), weight: String(q.weight),
    paymentType: cod ? 'COD' : 'Prepaid', serviceType: service.id,
    ...(cod ? { codAmount: String(q.codAmount || q.orderAmount) } : {}),
    invoiceAmount: String(q.orderAmount),
  });
  const entries = (Array.isArray(list) ? list : []).map((e) => rateEntry(service, e));
  return entries.length ? cheapest(entries) : null;
}

// Pickup locations must be registered with Ekart. Reuse one with our warehouse title, else register it once.
async function ensureAlias(wh) {
  if (wh.providerIds?.ekart) return String(wh.providerIds.ekart);
  const list = await api.addresses();
  const found = (Array.isArray(list) ? list : []).find((a) => String(a.alias).toLowerCase() === String(wh.title).toLowerCase());
  let alias = found?.alias;
  if (!alias) {
    await api.createAddress({
      alias: wh.title,
      phone: Number(digits(wh.phone)),
      address_line1: wh.address,
      address_line2: optional(wh.address2),
      pincode: Number(wh.pincode),
      city: wh.city,
      state: wh.state,
      country: 'India',
    });
    alias = wh.title;
  }
  wh.providerIds = { ...(wh.providerIds || {}), ekart: String(alias) };
  if (wh.markModified) wh.markModified('providerIds');
  if (wh.save) await wh.save();
  return String(alias);
}

// Invoice number/date and GST rate come from the order's invoice when it has one
async function invoiceInfo(order) {
  let invoice = null;
  if (order._id) invoice = await Invoice.findOne({ order: order._id }).catch(() => null);
  return {
    number: invoice?.invoiceNo || order.orderId,
    date: ymd(invoice?.invoiceDate || order.orderDate),
    gstPercent: invoice?.taxPercent ?? cfg.gstPercent ?? 0,
  };
}

const shipmentBody = async ({ order, customer, alias, parcel, ref, service, payment, reverseReason }) => {
  const total = Math.max(1, round2(order.totalAmount));
  const inv = await invoiceInfo(order);
  const tax = round2(total - total / (1 + (Number(inv.gstPercent) || 0) / 100));
  const taxable = Math.max(1, round2(total - tax));
  return {
    ...sellerDetails(),
    seller_gst_amount: tax,
    consignee_gst_amount: 0,
    integrated_gst_amount: 0,
    order_number: ref,
    invoice_number: inv.number,
    invoice_date: inv.date,
    consignee_name: customer.name,
    consignee_alternate_phone: digits(customer.mobile),
    products_desc: order.items.map((i) => `${i.name} x${i.quantity}`).join(', ').slice(0, 250),
    payment_mode: reverseReason ? 'Pickup' : payment.type === 'COD' ? 'COD' : 'Prepaid',
    category_of_goods: cfg.category,
    ...(cfg.hsnCode ? { hsn_code: cfg.hsnCode } : {}),
    total_amount: total,
    tax_value: tax,
    taxable_amount: taxable,
    commodity_value: String(taxable),
    cod_amount: !reverseReason && payment.type === 'COD' ? payment.codAmount : 0,
    quantity: order.items.reduce((n, i) => n + i.quantity, 0),
    weight: parcel.weight,
    length: parcel.length,
    height: parcel.height,
    width: parcel.width,
    return_reason: reverseReason || '',
    drop_location: { // customer (for reverse shipments too: Ekart's API treats the sides this way)
      location_type: 'Home',
      address: [customer.address, optional(customer.area)].filter(Boolean).join(', '),
      city: customer.city,
      state: customer.state,
      country: 'India',
      name: customer.name,
      phone: Number(digits(customer.mobile)),
      pin: Number(customer.pincode),
    },
    pickup_location: { name: alias },
    ...(reverseReason ? {} : { return_location: { name: alias } }),
    service,
  };
};

module.exports = {
  id: 'ekart',
  displayName: 'Ekart',
  autoHint: 'Auto books Ekart Surface',
  capabilities: { manifest: true, ndr: false, ndrAction: true, ndrRto: true, returnReasons: false, courierList: false },

  isConfigured: client.isConfigured,

  async status() {
    if (!client.isConfigured()) return { configured: false, online: false, message: 'Ekart client id / username / password not set in backend/.env' };
    try {
      await api.ping();
      const list = await api.addresses();
      const missing = [!cfg.sellerName && 'EKART_SELLER_NAME', !cfg.sellerAddress && 'EKART_SELLER_ADDRESS', !cfg.sellerGstTin && 'EKART_SELLER_GST_TIN'].filter(Boolean);
      return {
        configured: true,
        online: true,
        message: `Login OK. ${Array.isArray(list) ? list.length : 0} pickup address(es) registered.${missing.length ? ` Booking will fail until you set ${missing.join(', ')}.` : ''}`,
      };
    } catch (err) {
      return { configured: true, online: false, message: err.message };
    }
  },

  async rates(q) {
    const results = await Promise.allSettled(SERVICES.map((s) => quote(q, s)));
    const options = results.filter((r) => r.status === 'fulfilled' && r.value).map((r) => r.value);
    if (!options.length) {
      const failed = results.find((r) => r.status === 'rejected');
      if (failed) throw failed.reason;
    }
    return options;
  },

  async serviceability({ origin, destination }) {
    const couriers = await this.rates({ origin, destination, paymentType: 'PREPAID', orderAmount: 500, weight: 500, length: 10, width: 10, height: 10 });
    return { serviceable: couriers.length > 0, couriers };
  },

  async book({ order, customer, warehouse, parcel, payment, input, ref }) {
    requireCustomerAddress(customer);
    if (payment.type === 'COD' && payment.codAmount > COD_LIMIT) throw new ApiError(400, `Ekart accepts COD up to Rs ${COD_LIMIT}`);
    sellerDetails(); // fail early, before registering anything
    const alias = await ensureAlias(warehouse);
    const service = serviceOf(input.courierId);
    const data = await api.createShipment(await shipmentBody({ order, customer, alias, parcel, ref, service, payment }));
    if (!data?.tracking_id) throw new ApiError(502, 'Ekart did not return a tracking id');
    return {
      awb: data.tracking_id,
      courierId: service,
      courierName: `${serviceName(service)}${data.vendor ? ` (${data.vendor})` : ''}`,
      providerOrderId: ref,
      raw: data,
    };
  },

  async track(awb) {
    const data = await api.track(awb);
    const t = data.track || {};
    const when = (ms) => (ms ? `${new Date(ms).toISOString().replace('T', ' ').slice(0, 16)} UTC` : undefined);
    const details = [...(Array.isArray(t.details) ? t.details : [])].sort((a, b) => (b.ctime || 0) - (a.ctime || 0));
    return {
      awb: data._id || awb,
      status: t.status,
      history: details.map((h) => ({
        message: [h.status, h.desc].filter(Boolean).join(' - '),
        location: h.location,
        time: when(h.ctime),
      })),
      ndr: t.ndrStatus || t.ndrActions?.length ? { status: t.ndrStatus, actions: t.ndrActions || [], attempts: t.attempts } : undefined,
      raw: data,
    };
  },

  async label(order) {
    const pdf = await api.label([order.shipping.awb]);
    if (!Buffer.isBuffer(pdf)) throw new ApiError(404, 'Ekart has no label for this shipment yet');
    return `data:application/pdf;base64,${pdf.toString('base64')}`;
  },

  async manifest(order) {
    const data = await api.manifest([order.shipping.awb]);
    if (!data?.manifestDownloadUrl) throw new ApiError(502, 'Ekart did not return a manifest link');
    return data.manifestDownloadUrl;
  },

  async cancel(order) {
    const data = await api.cancel(order.shipping.awb);
    const r = Array.isArray(data?.data) ? data.data[0] : data;
    if (r && r.status === false) throw new ApiError(400, `Ekart: ${r.remark || 'could not cancel the shipment'}`);
    return data;
  },

  async pushReturn({ order, customer, warehouse, input, ref }) {
    requireCustomerAddress(customer);
    const s = order.shipping || {};
    const parcel = {
      weight: Number(input.weight) || s.weight || 500, // grams
      length: Number(input.length) || s.length || 10,
      width: Number(input.width) || s.width || 10,
      height: Number(input.height) || s.height || 10,
    };
    const alias = await ensureAlias(warehouse);
    const data = await api.createShipment(await shipmentBody({
      order, customer, alias, parcel, ref: `${ref}-R`, service: serviceOf(s.courierId), payment: { type: 'PREPAID', codAmount: 0 },
      reverseReason: (input.reason || '').trim() || 'Customer return',
    }));
    return { returnAwb: data?.tracking_id, raw: data };
  },

  // NDR: Ekart has no list API. The open exception and its allowed actions come with Track shipment.
  async ndrAction(order, input) {
    const action = input.action;
    if (!['Re-Attempt', 'RTO'].includes(action)) throw new ApiError(400, 'Action must be Re-Attempt or RTO');
    const body = { action, wbn: order.shipping.awb };
    if (action === 'Re-Attempt') {
      const date = new Date(`${input.date}T00:00:00Z`).getTime();
      const days = (date - Date.now()) / 86400000;
      if (!Number.isFinite(date) || days <= 0 || days > 8) throw new ApiError(400, 'Re-attempt date must be within the next 7 days (not today)');
      body.date = date;
    }
    if (input.phone) {
      if (!/^\d{10}$/.test(String(input.phone))) throw new ApiError(400, 'Phone must be 10 digits');
      body.phone = String(input.phone);
    }
    if (input.address) body.address = input.address;
    if (input.instructions) body.instructions = input.instructions;
    return api.ndr(body);
  },
};
