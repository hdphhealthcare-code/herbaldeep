const api = require('../delhiveryApi');
const client = require('../delhiveryClient');
const { delhivery: cfg } = require('../../config/env');
const { BRAND_NAME } = require('../../config/constants');
const ApiError = require('../../utils/ApiError');
const Warehouse = require('../../models/Warehouse');
const { digits, optional, requireCustomerAddress, deepFind } = require('./common');

/**
 * Delhivery provider (Express / B2C API, token based).
 * Flow: pincode check -> shipping cost for Surface (S) and Express (E) -> pickup location registered once
 *       -> create shipment (waybill = AWB) -> label (PDF) / pickup request / track / cancel / NDR re-attempt
 * Delhivery has no courier list: the choice is the service, Surface or Express.
 */
const SERVICES = [{ id: 'S', name: 'Delhivery Surface', shipping_mode: 'Surface' }, { id: 'E', name: 'Delhivery Express', shipping_mode: 'Express' }];
const serviceOf = (id) => (['E', 'EXPRESS'].includes(String(id).toUpperCase()) ? SERVICES[1] : SERVICES[0]);
const num = (v) => (v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined);
const round2 = (n) => Math.round(n * 100) / 100;
const isStaging = () => /staging/i.test(cfg.baseUrl);

const pinInfo = async (pin) => {
  const data = await api.pincode(String(pin));
  return data?.delivery_codes?.[0]?.postal_code || null;
};

// Serviceability of a route for one payment type. Throws a readable error when Delhivery cannot do it.
async function checkRoute({ origin, destination, paymentType }) {
  const [from, to] = await Promise.all([pinInfo(origin), pinInfo(destination)]);
  if (!from || String(from.pickup).toUpperCase() === 'N') throw new ApiError(400, `Delhivery: pickup pincode ${origin} is not serviceable for pickup`);
  if (!to) throw new ApiError(400, `Delhivery: delivery pincode ${destination} is not serviceable`);
  if (paymentType === 'COD' && String(to.cod ?? to.cash).toUpperCase() !== 'Y') throw new ApiError(400, `Delhivery: COD is not available at ${destination}`);
  if (paymentType !== 'COD' && String(to.pre_paid).toUpperCase() === 'N') throw new ApiError(400, `Delhivery: prepaid delivery is not available at ${destination}`);
  return { from, to };
}

async function quote(service, q) {
  const cod = q.paymentType === 'COD';
  const [charges, tat] = await Promise.allSettled([
    api.charges({
      md: service.id, ss: 'Delivered', d_pin: q.destination, o_pin: q.origin,
      cgm: Math.max(Math.round(Number(q.weight) || 0), 1), pt: cod ? 'COD' : 'Pre-paid', cod: cod ? q.codAmount || q.orderAmount : 0,
      cl: cfg.clientName || undefined,
    }),
    api.tat({ origin_pin: q.origin, destination_pin: q.destination, mot: service.id, pdt: 'B2C' }), // nice to have: delivery days
  ]);
  if (charges.status === 'rejected') throw charges.reason;
  const e = Array.isArray(charges.value) ? charges.value[0] : charges.value;
  const total = num(e?.total_amount);
  if (total === undefined) return null;
  const days = tat.status === 'fulfilled' ? num(tat.value?.data?.tat ?? tat.value?.tat) : undefined;
  return {
    id: service.id,
    name: service.name,
    service: service.shipping_mode,
    rate: round2(total),
    freight: num(e.charge_DL ?? e.gross_amount),
    cod: num(e.charge_COD),
    eta: days ? `${days} days` : undefined,
  };
}

// The pickup location is registered with Delhivery by name (it must match exactly on every shipment). Done once per warehouse.
async function ensureWarehouse(wh) {
  if (wh.providerIds?.delhivery) return String(wh.providerIds.delhivery);
  const address = [wh.address, optional(wh.address2)].filter(Boolean).join(', ');
  try {
    const r = await api.createWarehouse({
      name: wh.title, registered_name: BRAND_NAME, email: optional(wh.email) || '', phone: digits(wh.phone),
      address, city: wh.city, pin: String(wh.pincode), country: 'India',
      return_address: address, return_pin: String(wh.pincode), return_city: wh.city, return_state: wh.state, return_country: 'India',
    });
    if (r && r.success === false) throw new ApiError(400, `Delhivery: ${client.failureMessage(r, { status: 200 })}`);
  } catch (err) {
    if (!/already|exist|duplicate/i.test(err.message)) throw err; // created earlier (maybe in the Delhivery panel): just use it
  }
  wh.providerIds = { ...(wh.providerIds || {}), delhivery: String(wh.title) };
  if (wh.markModified) wh.markModified('providerIds');
  if (wh.save) await wh.save();
  return String(wh.title);
}

// Pickup slot: ~2 hours from now (IST) if that is before 6 pm, else tomorrow 11 am
const pickupSlot = () => {
  const ist = new Date(Date.now() + 330 * 60000);
  let hour = ist.getUTCHours() + 2;
  let day = ist;
  if (hour >= 18) { day = new Date(ist.getTime() + 86400000); hour = 11; }
  return { date: day.toISOString().slice(0, 10), time: `${String(hour).padStart(2, '0')}:00:00` };
};

/**
 * Delhivery status -> plain wording our status mapper understands.
 * Delhivery sends Status ("In Transit", "Pending", "Dispatched", "Delivered", "RTO"...) plus StatusType
 * (UD undelivered/moving, DL delivered, RT returning, PP pickup pending, PU picked up, CN cancelled).
 * "Pending" and "Dispatched" mean *delivery* stages for Delhivery, so they are translated here instead of being guessed.
 */
const statusText = (st = {}) => {
  const status = String(st.Status || '').trim();
  const s = status.toLowerCase();
  const type = String(st.StatusType || '').toUpperCase();
  const note = String(st.Instructions || '');
  if (s === 'rto') return type === 'DL' ? 'RTO Delivered' : 'RTO In Transit';
  if (type === 'RT') return 'RTO In Transit';
  if (type === 'DL' || s === 'delivered') return 'Delivered';
  if (type === 'CN' || s.includes('cancel')) return 'Cancelled';
  if (s === 'dispatched') return 'Out For Delivery';
  if (s === 'pending') {
    if (/out\s*for\s*delivery/i.test(note)) return 'Out For Delivery';
    if (/attempt|unavailable|not\s*available|refus|closed|incorrect|incomplete|reschedul|no\s*response|not\s*reachable|address|consignee|customer/i.test(note)) return 'Undelivered';
    return 'In Transit';
  }
  if (s === 'manifested') return 'Manifested';
  if (s === 'not picked') return 'Not Picked';
  if (type === 'PP') return 'Pickup Pending';
  if (type === 'PU') return 'Picked Up';
  return status || type;
};

const fromShipment = (shipment = {}) => {
  const st = shipment.Status || {};
  const status = statusText(st);
  const scans = (Array.isArray(shipment.Scans) ? shipment.Scans : []).map((x) => x.ScanDetail || x)
    .sort((a, b) => String(b.ScanDateTime || '').localeCompare(String(a.ScanDateTime || '')));
  const history = scans.length
    ? scans.map((x) => ({ message: [x.Scan, x.Instructions].filter(Boolean).join(' - '), location: x.ScannedLocation, time: x.ScanDateTime }))
    : [{ message: [status, st.Instructions].filter(Boolean).join(' - '), location: st.StatusLocation, time: st.StatusDateTime }];
  return {
    awb: shipment.AWB,
    status,
    history,
    ndr: status === 'Undelivered' ? { status: st.Instructions || 'Delivery failed', actions: ['Re-Attempt'] } : undefined,
  };
};

module.exports = {
  id: 'delhivery',
  displayName: 'Delhivery',
  autoHint: 'Auto books Delhivery Surface',
  // manifest = pickup request. ndrAction = re-attempt / defer. No courier list, no return-reason list.
  capabilities: { manifest: true, ndr: false, ndrAction: true, returnReasons: false, courierList: false, returns: false },

  isConfigured: client.isConfigured,

  async status() {
    if (!client.isConfigured()) return { configured: false, online: false, message: 'Delhivery API token not set in backend/.env (DELHIVERY_API_TOKEN)' };
    try {
      await api.pincode('110001');
      return {
        configured: true,
        online: true,
        message: `API token accepted by ${cfg.baseUrl}.${isStaging() ? ' This is the STAGING server: shipments made here are test shipments.' : ''}`,
      };
    } catch (err) {
      return { configured: true, online: false, message: err.message };
    }
  },

  async rates(q) {
    await checkRoute(q);
    const results = await Promise.allSettled(SERVICES.map((s) => quote(s, q)));
    const options = results.filter((r) => r.status === 'fulfilled' && r.value).map((r) => r.value);
    if (!options.length) {
      const failed = results.find((r) => r.status === 'rejected');
      throw failed ? failed.reason : new ApiError(400, 'Delhivery returned no rate for this route');
    }
    return options;
  },

  async serviceability({ origin, destination }) {
    try {
      const { to } = await checkRoute({ origin, destination, paymentType: 'PREPAID' });
      return { serviceable: true, couriers: SERVICES.map((s) => ({ id: s.id, name: s.name })), cod: String(to.cod ?? to.cash).toUpperCase() === 'Y' };
    } catch (err) {
      if (err.statusCode === 400 || err.status === 400) return { serviceable: false, couriers: [], reason: err.message };
      throw err;
    }
  },

  async book({ order, customer, warehouse, parcel, payment, input, ref }) {
    requireCustomerAddress(customer);
    const service = serviceOf(input.courierId);
    await checkRoute({ origin: warehouse.pincode, destination: customer.pincode, paymentType: payment.type });
    const pickupName = await ensureWarehouse(warehouse);
    const wAddress = [warehouse.address, optional(warehouse.address2)].filter(Boolean).join(', ');

    const data = await api.createOrder({
      pickup_location: { name: pickupName },
      shipments: [{
        name: customer.name,
        add: [customer.address, optional(customer.area)].filter(Boolean).join(', '),
        pin: String(customer.pincode),
        city: customer.city,
        state: customer.state,
        country: 'India',
        phone: digits(customer.mobile),
        order: ref,
        payment_mode: payment.type === 'COD' ? 'COD' : 'Prepaid',
        cod_amount: payment.type === 'COD' ? String(payment.codAmount) : '0',
        total_amount: String(round2(order.totalAmount)),
        products_desc: order.items.map((i) => `${i.name} x${i.quantity}`).join(', ').slice(0, 250),
        quantity: String(order.items.reduce((n, i) => n + i.quantity, 0)),
        ...(cfg.hsnCode ? { hsn_code: cfg.hsnCode } : {}),
        weight: String(parcel.weight), // grams
        shipment_length: String(parcel.length),
        shipment_width: String(parcel.width),
        shipment_height: String(parcel.height),
        shipping_mode: service.shipping_mode,
        address_type: 'home',
        seller_name: BRAND_NAME,
        seller_add: wAddress,
        seller_inv: order.orderId,
        return_name: warehouse.title,
        return_add: wAddress,
        return_pin: String(warehouse.pincode),
        return_city: warehouse.city,
        return_state: warehouse.state,
        return_country: 'India',
        return_phone: digits(warehouse.phone),
        waybill: '',
      }],
    });

    const pkg = data?.packages?.[0];
    if (!pkg || !pkg.waybill || String(pkg.status).toLowerCase() === 'fail') {
      const why = [].concat(pkg?.remarks || []).filter(Boolean).join(', ') || data?.rmk || 'could not create the shipment';
      throw new ApiError(400, `Delhivery: ${why}`);
    }
    return { awb: String(pkg.waybill), courierId: service.id, courierName: service.name, providerOrderId: ref, raw: data };
  },

  async track(awb) {
    const data = await api.track(awb);
    const shipment = data?.ShipmentData?.[0]?.Shipment;
    if (!shipment) throw new ApiError(404, `Delhivery has no tracking data for AWB ${awb} yet`);
    return { ...fromShipment(shipment), awb: shipment.AWB || awb, raw: data };
  },

  // Delhivery's push webhook: { Shipment: { AWB, Status: { Status, StatusType, StatusLocation, StatusDateTime, Instructions } } }
  fromWebhook(body = {}) {
    const shipment = body.Shipment || body.shipment;
    if (!shipment?.AWB) return null;
    const r = fromShipment(shipment);
    return { awb: String(r.awb), status: r.status, history: r.history };
  },

  async label(order) {
    const out = await api.packingSlip(order.shipping.awb);
    if (out?.buffer) return `data:application/pdf;base64,${out.buffer.toString('base64')}`;
    const link = deepFind(out, ['pdf_download_link', 'pdf_url', 'pdf_link', 'label_url'], 3);
    if (link) return String(link);
    const b64 = deepFind(out, ['pdf_encoding', 'pdf_base64'], 3);
    if (b64) return `data:application/pdf;base64,${b64}`;
    throw new ApiError(404, 'Delhivery did not return a PDF label for this shipment. Use the CRM label (4x6) instead');
  },

  // "Manifest" for Delhivery = request a pickup for the parcels waiting at the warehouse
  async manifest(order) {
    const wh = await Warehouse.findById(order.shipping.warehouseId).catch(() => null);
    if (!wh) throw new ApiError(400, 'Pickup warehouse of this shipment was not found. Add it again in Shipping > Warehouses');
    const name = await ensureWarehouse(wh);
    const slot = pickupSlot();
    try {
      const r = await api.pickupRequest({ pickup_location: name, pickup_date: slot.date, pickup_time: slot.time, expected_package_count: 1 });
      if (r && (r.success === false || r.error) && !/already|exist/i.test(JSON.stringify(r))) throw new ApiError(400, `Delhivery: ${client.failureMessage(r, { status: 200 })}`);
    } catch (err) {
      if (!/already|exist/i.test(err.message)) throw err; // a pickup is already requested for that day: fine
    }
    return undefined; // no PDF sheet: Delhivery sends the pickup agent
  },

  async cancel(order) {
    const data = await api.cancel(order.shipping.awb);
    if (data && (data.status === false || data.success === false)) {
      throw new ApiError(400, `Delhivery: ${client.failureMessage(data, { status: 200 }) || 'could not cancel the shipment'}`);
    }
    return data;
  },

  async pushReturn() {
    // Reverse pickups use a different payload (the customer becomes the pickup address). It is not enabled until it can be tested on a live account.
    throw new ApiError(400, 'Return pickup with Delhivery is not available from the CRM yet. Create the return from the Delhivery panel');
  },

  // NDR: Delhivery sends undelivered parcels back by itself (RTO). From the CRM you can ask for a re-attempt, optionally on a later date.
  async ndrAction(order, input) {
    if (input.action !== 'Re-Attempt') throw new ApiError(400, 'Delhivery supports Re-Attempt only. Undelivered parcels return to you automatically');
    const item = { waybill: order.shipping.awb, act: input.date ? 'DEFER_DLV' : 'RE-ATTEMPT' };
    if (input.date) item.action_data = { deferred_date: String(input.date).slice(0, 10) };
    const r = await api.ndr({ data: [item] });
    if (r && (r.success === false || r.status === false)) throw new ApiError(400, `Delhivery: ${client.failureMessage(r, { status: 200 })}`);
    return r;
  },
};
