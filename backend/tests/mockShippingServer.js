/**
 * Local FAKE courier server (Xpressbees + Shipmozo + Ekart) to test the CRM without spending wallet money.
 *   npm run mock:shipping        -> http://localhost:5055
 * In backend/.env point the CRM at it (remove these lines to go back to the real couriers):
 *   XPRESSBEES_BASE_URL=http://localhost:5055/api
 *   XPRESSBEES_EMAIL=test@test.com
 *   XPRESSBEES_PASSWORD=test
 *   SHIPMOZO_BASE_URL=http://localhost:5055/app/api/v1
 *   SHIPMOZO_PUBLIC_KEY=test
 *   SHIPMOZO_PRIVATE_KEY=test
 *
 *   EKART_BASE_URL=http://localhost:5055/ekart
 *   EKART_CLIENT_ID=test
 *   EKART_USERNAME=test
 *   EKART_PASSWORD=test
 *   EKART_SELLER_NAME=Herbal Deep Test Seller
 *   EKART_SELLER_ADDRESS=Plot 1, Sector 18, Gurgaon
 *   EKART_SELLER_GST_TIN=06ABCDE1234F1Z5
 *
 *   DELHIVERY_BASE_URL=http://localhost:5055/delhivery
 *   SHIPROCKET_BASE_URL=http://localhost:5055/shiprocket  SHIPROCKET_EMAIL=api@x.com  SHIPROCKET_PASSWORD=sr-pw
 *   DELHIVERY_API_TOKEN=dl-token
 *
 * Behaviour: any login / key works. Pincodes starting with 000 are not serviceable. Every booking gets a fake AWB
 * and PDF/PNG label. Tracking advances on each call: pending pickup -> in transit -> delivered.
 * Shipmozo mock: courier 1 "Delhivery" auto-schedules pickup, courier 2 "Professional 0.5KG" is cheaper but needs schedule-pickup.
 */
const http = require('http');

const state = {
  dl: { seq: 0, shipments: new Map(), warehouses: new Set(), orders: new Set(), pickups: new Set(), ndrs: [] },
  sr: { seq: 0, pickups: new Map(), orders: new Map(), shipments: new Map(), ndrs: [], lowWallet: false, pickupCalls: new Set(), cancelledOrders: [] },
  xb: new Map(),            // awb -> { orderNumber, polls, cancelled }
  sm: { orders: new Map(), warehouses: new Map(), seq: 0 }, // order_id -> { courier, awb, polls, cancelled }
  ek: { addresses: new Map(), shipments: new Map(), seq: 0 }, // tracking_id -> { polls, cancelled, order }
  seq: 0,
};

// Pincodes starting with 000 are unserviceable (Shipmozo takes numbers, so 000111 arrives as 111: treat short ones as bad too)
const bad = (p) => String(p).startsWith('000') || String(p).length < 6;

// ---------------- Xpressbees ----------------
const jwt = () => `h.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 10800 })).toString('base64url')}.s`;
const ok = (data) => ({ status: true, data });
const fail = (message) => ({ status: false, message });
const XB_COURIERS = [
  { id: '1', name: 'Surface Xpressbees 0.5 K.G', freight: 63, min: 500 },
  { id: '2', name: 'Xpressbees 2 K.G', freight: 70, min: 2000 },
  { id: '6', name: 'Air Xpressbees 0.5 K.G', freight: 98, min: 500 },
];
const XB_STEPS = [
  { status: 'pending pickup', code: 'PP', message: 'Out For Pickup' },
  { status: 'in transit', code: 'IT', message: 'Shipment In Transit' },
  { status: 'delivered', code: 'DL', message: 'Delivered' },
];

const xpressbees = (method, path, body, host) => {
  if (method === 'POST' && path === '/api/users/login') return body.email && body.password ? ok(jwt()) : fail('Invalid email or password');
  if (method === 'GET' && path === '/api/courier') return ok(XB_COURIERS.map((c) => ({ id: c.id, name: c.name })));
  if (method === 'POST' && path === '/api/courier/serviceability') {
    if (bad(body.destination) || bad(body.origin)) return fail('Destination pincode not serviceable');
    const cod = body.payment_type === 'cod';
    const w = Number(body.weight) || 500;
    return ok(XB_COURIERS.map((c) => ({
      id: c.id, name: c.name, freight_charges: c.freight, cod_charges: cod ? 40 : 0,
      total_charges: c.freight + (cod ? 40 : 0), min_weight: c.min, chargeable_weight: Math.max(w, c.min),
    })));
  }
  if (method === 'POST' && path === '/api/shipments2') {
    if (bad(body.consignee?.pincode)) return fail('Destination pincode not serviceable');
    const c = XB_COURIERS.find((x) => x.id === String(body.courier_id)) || XB_COURIERS[0];
    const awb = `1434494${String(++state.seq).padStart(7, '0')}`;
    state.xb.set(awb, { orderNumber: body.order_number, polls: 0, cancelled: false });
    return ok({
      order_id: 19000000 + state.seq, shipment_id: 9500000 + state.seq, awb_number: awb, courier_id: c.id, courier_name: c.name,
      status: 'booked', label: `http://${host}/files/label-${awb}.pdf`, manifest: `http://${host}/files/manifest-${awb}.pdf`,
    });
  }
  const track = path.match(/^\/api\/shipments2\/track\/(.+)$/);
  if (method === 'GET' && track) {
    const s = state.xb.get(track[1]);
    if (!s || s.cancelled) return fail('AWB not found');
    const step = Math.min(s.polls++, XB_STEPS.length - 1);
    return ok({
      order_number: s.orderNumber, awb_number: track[1], status: XB_STEPS[step].status,
      history: XB_STEPS.slice(0, step + 1).reverse().map((h, i) => ({
        status_code: h.code, location: 'Gurgaon, HARYANA', event_time: `2026-10-30 1${step - i}:00`, message: h.message,
      })),
    });
  }
  if (method === 'POST' && path === '/api/shipments2/manifest') {
    const first = (body.awbs || [])[0];
    return first && state.xb.has(first) ? ok(`http://${host}/files/manifest-${first}.pdf`) : fail('AWB not found');
  }
  if (method === 'POST' && path === '/api/shipments2/cancel') {
    const s = state.xb.get(body.awb);
    if (!s || s.cancelled) return fail('Shipment not found or already cancelled');
    s.cancelled = true;
    return { status: true, message: 'Shipment Cancelled' };
  }
  if (method === 'POST' && path === '/api/reverseshipments') {
    const awb = `2434498${String(++state.seq).padStart(7, '0')}`;
    return ok({ order_id: 19100000 + state.seq, shipment_id: 9600000 + state.seq, awb_number: awb, courier_name: 'Express Reverse', status: 'booked' });
  }
  if (method === 'GET' && path === '/api/ndr') {
    return ok([...state.xb.entries()].filter(([, s]) => !s.cancelled).slice(0, 1)
      .map(([awb]) => ({ awb_number: awb, event_date: '2026-10-30', courier_remarks: 'Customer not available (mock)', total_attempts: '1' })));
  }
  if (method === 'POST' && path === '/api/ndr/create') {
    return (Array.isArray(body) ? body : []).map((x) => ({ status: true, awb: x.awb, message: 'NDR Submitted Successfully' }));
  }
  return fail(`Mock: no such route ${method} ${path}`);
};

// ---------------- Shipmozo ----------------
const smOk = (data) => ({ result: '1', message: 'Success', data });
const smFail = (message) => ({ result: '0', message });
const SM_COURIERS = [
  { courier_id: 1, name: 'Delhivery', total_charges: 80, pickups_automatically_scheduled: 'YES' },
  { courier_id: 2, name: 'Professional 0.5KG', total_charges: 62, pickups_automatically_scheduled: 'NO' },
];
const SM_STEPS = ['Pickup Pending', 'In Transit', 'Delivered'];
const SM_PREFIX = '/app/api/v1';

const shipmozo = (method, rawPath, body, headers, host) => {
  const [path, qs] = rawPath.replace(SM_PREFIX, '').split('?');
  if (path === '/info') return smOk({ Info: 'Hello External V1 Api World!' });
  if (path === '/login') return smOk([{ name: 'Mock', public_key: 'test', private_key: 'test' }]);
  if (!headers['public-key'] || !headers['private-key']) return smFail('Invalid public-key or private-key');

  if (path === '/get-warehouses') return smOk([...state.sm.warehouses.values()]);
  if (path === '/create-warehouse') {
    const existing = state.sm.warehouses.get(body.address_title);
    if (existing) return smOk({ warehouse_id: String(existing.id) });
    const id = 23480 + ++state.sm.seq;
    state.sm.warehouses.set(body.address_title, { id, address_title: body.address_title, pincode: String(body.pin_code), status: 'ACTIVE' });
    return smOk({ warehouse_id: String(id) });
  }
  if (path === '/pincode-serviceability') return smOk({ serviceable: !bad(body.delivery_pincode) });
  if (path === '/rate-calculator') {
    if (bad(body.delivery_pincode)) return smFail('Delivery pincode not serviceable');
    return smOk(SM_COURIERS);
  }
  if (path === '/push-order') {
    if (!body.warehouse_id) return smFail('warehouse_id is required');
    if (state.sm.orders.has(body.order_id)) return smFail('Order already exists');
    state.sm.orders.set(body.order_id, { courier: null, awb: null, polls: 0, cancelled: false });
    return smOk({ Info: 'Order Pushed Successfully', order_id: body.order_id, reference_id: body.order_id });
  }
  if (path === '/push-return-order') {
    if (!body.return_reason_id) return smFail('return_reason_id is required');
    state.sm.orders.set(body.order_id, { courier: null, awb: null, polls: 0, cancelled: false });
    return smOk({ Info: 'Order Pushed Successfully', order_id: body.order_id, reference_id: body.order_id });
  }
  if (path === '/assign-courier') {
    const o = state.sm.orders.get(body.order_id);
    const c = SM_COURIERS.find((x) => x.courier_id === Number(body.courier_id));
    if (!o) return smFail('Order not found');
    if (!c) return smFail('Courier not found');
    o.courier = c;
    if (c.pickups_automatically_scheduled === 'YES') o.awb = `SM${String(++state.seq).padStart(8, '0')}`;
    return smOk({ order_id: body.order_id, reference_id: body.order_id, courier: c.name });
  }
  if (path === '/schedule-pickup') {
    const o = state.sm.orders.get(body.order_id);
    if (!o || !o.courier) return smFail('Order not found');
    if (o.courier.pickups_automatically_scheduled === 'YES') return smFail('Pickup is scheduled automatically');
    o.awb = o.awb || `SM${String(++state.seq).padStart(8, '0')}`;
    return smOk({ order_id: body.order_id, reference_id: body.order_id, courier: o.courier.name, awb_number: o.awb, lr_number: '58930303' });
  }
  const detail = path.match(/^\/get-order-detail\/(.+)$/);
  if (detail) {
    const o = state.sm.orders.get(decodeURIComponent(detail[1]));
    if (!o) return smFail('Order not found');
    return smOk({ order_id: decodeURIComponent(detail[1]), courier: o.courier?.name || null, awb_number: o.awb });
  }
  if (path === '/track-order') {
    const awb = new URLSearchParams(qs).get('awb_number');
    const o = [...state.sm.orders.values()].find((x) => x.awb === awb);
    if (!o || o.cancelled) return smFail('AWB not found');
    const step = Math.min(o.polls++, SM_STEPS.length - 1);
    return smOk({
      awb_number: awb, courier: o.courier.name, current_status: SM_STEPS[step],
      scan_detail: SM_STEPS.slice(0, step + 1).reverse().map((s, i) => ({ status: s, location: 'Delhi', time: `2026-10-30 1${step - i}:00` })),
    });
  }
  const label = path.match(/^\/get-order-label\/(.+)$/);
  if (label) {
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    return smOk([{ label: `data:image/png;base64,${png}`, created_at: '2026-10-30 12:00:00' }]);
  }
  if (path === '/cancel-order') {
    const o = state.sm.orders.get(body.order_id);
    if (!o || o.cancelled) return smFail('Order not found or already cancelled');
    o.cancelled = true;
    return smOk({ order_id: body.order_id, reference_id: body.order_id });
  }
  if (path === '/get-return-reason') return smOk([{ id: 9, title: 'Item is damaged' }, { id: 14, title: 'Other' }]);
  return smFail(`Mock: no such route ${method} ${path}`);
};


// ---------------- Ekart ----------------
const EK_PREFIX = '/ekart';
const EK_STEPS = [
  { status: 'Pickup Scheduled', desc: 'Pickup scheduled' },
  { status: 'In Transit', desc: 'Shipment in transit', ndr: true },
  { status: 'Delivered', desc: 'Delivered to customer' },
];
const ekFail = (message, statusCode = 400) => ({ __http: statusCode, statusCode, code: 'ERR', message, description: message, severity: 'ERROR' });

const ekart = (method, rawPath, body, headers) => {
  const [path, qs] = rawPath.replace(EK_PREFIX, '').split('?');
  if (method === 'POST' && path.startsWith('/integrations/v2/auth/token/')) {
    return body.username && body.password
      ? { access_token: 'ek-token-123', scope: 'core:all', expires_in: 86400, token_type: 'Bearer' }
      : ekFail('Invalid credentials', 401);
  }
  if (!headers.authorization) return ekFail('Unauthorized', 401);

  if (method === 'GET' && path === '/api/v2/addresses') return [...state.ek.addresses.values()];
  if (method === 'POST' && path === '/api/v2/address') {
    if (state.ek.addresses.has(body.alias)) return { status: false, alias: body.alias, remark: 'Alias already exists' };
    state.ek.addresses.set(body.alias, { alias: body.alias, phone: body.phone, address_line1: body.address_line1, pincode: body.pincode, city: body.city, state: body.state, country: 'India' });
    return { status: true, alias: body.alias, remark: 'Address added' };
  }
  if (method === 'POST' && path === '/data/v3/serviceability') {
    if (bad(body.dropPincode) || bad(body.pickupPincode)) return [];
    const surface = body.serviceType === 'SURFACE';
    const cod = body.paymentType === 'COD' ? 35 : 0;
    const freight = surface ? 55 : 90;
    return [{
      tat: surface ? { min: 3, max: 5 } : { min: 1, max: 2 }, courierGroup: surface ? 'Ekart Surface' : 'Ekart Air',
      forwardDeliveredCharges: { forwardFreight: String(freight), forwardFuelSurcharge: '5', codCharges: String(cod), deliveredTotalTax: '10', totalForwardDeliveredEstimate: String(freight + 5 + cod + 10) },
    }];
  }
  if (method === 'PUT' && path === '/api/v1/package/create') {
    const missing = ['seller_name', 'seller_gst_tin', 'order_number', 'invoice_number', 'consignee_alternate_phone', 'service']
      .filter((k) => !body[k]);
    if (missing.length) return ekFail(`Missing: ${missing.join(', ')}`);
    if (!state.ek.addresses.has(body.pickup_location?.name)) return { status: false, remark: 'pickup_location alias is not registered' };
    if (body.payment_mode === 'Pickup' && !body.return_reason) return { status: false, remark: 'return_reason is required for Pickup' };
    if (body.payment_mode === 'COD' && body.cod_amount > 49999) return { status: false, remark: 'cod_amount too high' };
    if (bad(body.drop_location?.pin)) return { status: false, remark: 'Drop pincode not serviceable' };
    const id = `EK${String(++state.ek.seq).padStart(10, '0')}`;
    state.ek.shipments.set(id, { polls: 0, cancelled: false, order: body.order_number });
    return { status: true, remark: 'Successfully created shipment', tracking_id: id, vendor: 'Ekart Logistics', barcodes: { wbn: id, order: body.order_number } };
  }
  if (method === 'DELETE' && path === '/api/v1/package/cancel') {
    const id = new URLSearchParams(qs).get('tracking_id');
    const s = state.ek.shipments.get(id);
    if (!s || s.cancelled) return { data: [{ status: false, tracking_id: id, remark: 'Shipment not found or already cancelled' }] };
    s.cancelled = true;
    return { data: [{ status: true, tracking_id: id, remark: 'Cancelled' }] };
  }
  if (method === 'POST' && path === '/data/v2/generate/manifest') {
    return { ctime: Date.now(), manifestNumber: 1234, manifestDownloadUrl: `http://${headers.host}/files/manifest-${(body.ids || [])[0]}.pdf` };
  }
  const track = path.match(/^\/api\/v1\/track\/(.+)$/);
  if (method === 'GET' && track) {
    const s = state.ek.shipments.get(decodeURIComponent(track[1]));
    if (!s || s.cancelled) return ekFail('Tracking id not found', 404);
    const step = Math.min(s.polls++, EK_STEPS.length - 1);
    const now = Date.now();
    const details = EK_STEPS.slice(0, step + 1).map((h, i) => ({ status: h.status, ctime: now - (step - i) * 3600000, desc: h.desc, location: 'Gurgaon' }));
    const cur = EK_STEPS[step];
    return {
      _id: decodeURIComponent(track[1]),
      track: { status: cur.status, ctime: now, desc: cur.desc, location: 'Gurgaon', details,
        ...(cur.ndr ? { ndrStatus: 'Customer Unavailable', attempts: 1, ndrActions: ['Re-Attempt', 'RTO'] } : {}) },
    };
  }
  if (method === 'POST' && path === '/api/v2/package/ndr') {
    if (!state.ek.shipments.has(body.wbn)) return { status: false, tracking_id: body.wbn, remark: 'Not found' };
    return { status: true, tracking_id: body.wbn, remark: `NDR ${body.action} submitted` };
  }
  return ekFail(`Mock: no such route ${method} ${path}`, 404);
};


// ---------------- Delhivery ----------------
const DL_PREFIX = '/delhivery';
const DL_STEPS = [
  { Status: 'Manifested', StatusType: 'UD', Instructions: 'Shipment manifested' },
  { Status: 'In Transit', StatusType: 'UD', Instructions: 'Shipment in transit' },
  { Status: 'Pending', StatusType: 'UD', Instructions: 'Consignee unavailable' },
  { Status: 'Dispatched', StatusType: 'UD', Instructions: 'Out for delivery' },
  { Status: 'Delivered', StatusType: 'DL', Instructions: 'Delivered to consignee' },
];
const dlFail = (message, statusCode = 400) => ({ __http: statusCode, error: message });

const delhivery = (method, rawPath, body, headers, form) => {
  const [path, qs] = rawPath.replace(DL_PREFIX, '').split('?');
  const q = new URLSearchParams(qs || '');
  if (headers.authorization !== 'Token dl-token') return { __http: 401, detail: 'Invalid token' };

  if (method === 'GET' && path === '/c/api/pin-codes/json/') {
    const pin = q.get('filter_codes');
    if (bad(pin)) return { delivery_codes: [] };
    return { delivery_codes: [{ postal_code: { pin: Number(pin), pre_paid: 'Y', cash: 'Y', cod: pin === '110002' ? 'N' : 'Y', pickup: 'Y', district: 'Mock District', state_code: 'HR' } }] };
  }
  if (method === 'GET' && path === '/api/kinko/v1/invoice/charges/.json') {
    if (!q.get('d_pin') || !q.get('o_pin') || !q.get('cgm')) return dlFail('Missing params');
    const express = q.get('md') === 'E';
    const cod = q.get('pt') === 'COD' ? 30 : 0;
    const freight = express ? 95 : 60;
    return [{ total_amount: freight + cod + 8, charge_DL: freight, charge_COD: cod, gross_amount: freight + cod + 8, zone: 'D2' }];
  }
  if (method === 'GET' && path === '/api/dc/expected_tat') return { success: true, data: { tat: q.get('mot') === 'E' ? 2 : 4 } };
  if (method === 'POST' && path === '/api/backend/clientwarehouse/create/') {
    if (state.dl.warehouses.has(body.name)) return { __http: 400, success: false, error: 'Client-Warehouse with this name already exists' };
    state.dl.warehouses.add(body.name);
    return { success: true, data: { name: body.name }, message: 'Warehouse created' };
  }
  if (method === 'POST' && path === '/api/cmu/create.json') {
    if (form.format !== 'json') return dlFail('format must be json');
    const data = JSON.parse(form.data);
    const sh = data.shipments[0];
    if (!state.dl.warehouses.has(data.pickup_location?.name)) return { success: false, rmk: 'ClientWarehouse matching query does not exist', packages: [] };
    if (state.dl.orders.has(sh.order)) return { success: true, packages: [{ status: 'Fail', waybill: '', remarks: [`Duplicate order id ${sh.order}`] }] };
    if (bad(sh.pin)) return { success: true, packages: [{ status: 'Fail', waybill: '', remarks: ['Pincode not serviceable'] }] };
    const missing = ['name', 'add', 'pin', 'phone', 'order', 'payment_mode', 'weight'].filter((k) => !sh[k]);
    if (missing.length) return { success: true, packages: [{ status: 'Fail', waybill: '', remarks: [`Missing ${missing.join(', ')}`] }] };
    const awb = `DL${String(++state.dl.seq).padStart(10, '0')}`;
    state.dl.orders.add(sh.order);
    state.dl.shipments.set(awb, { polls: 0, cancelled: false, mode: sh.shipping_mode, cod: sh.cod_amount, payment: sh.payment_mode, weight: sh.weight });
    return { success: true, package_count: 1, rmk: '', packages: [{ status: 'Success', waybill: awb, refnum: sh.order, remarks: [''], payment: sh.payment_mode }] };
  }
  if (method === 'GET' && path === '/api/v1/packages/json/') {
    const awb = q.get('waybill');
    const s = state.dl.shipments.get(awb);
    if (!s) return { ShipmentData: [] };
    if (s.cancelled) return { ShipmentData: [{ Shipment: { AWB: awb, Status: { Status: 'Cancelled', StatusType: 'CN', Instructions: 'Cancelled by seller', StatusDateTime: new Date().toISOString() }, Scans: [] } }] };
    const idx = Math.min(s.polls++, DL_STEPS.length - 1);
    const now = Date.now();
    const scans = DL_STEPS.slice(0, idx + 1).map((st, i) => ({ ScanDetail: { Scan: st.Status, ScanType: st.StatusType, Instructions: st.Instructions, ScannedLocation: 'Gurgaon', ScanDateTime: new Date(now - (idx - i) * 3600000).toISOString() } }));
    return { ShipmentData: [{ Shipment: { AWB: awb, Status: { ...DL_STEPS[idx], StatusLocation: 'Gurgaon', StatusDateTime: new Date(now).toISOString() }, Scans: scans } }] };
  }
  if (method === 'GET' && path === '/api/p/packing_slip') {
    const awb = q.get('wbns');
    if (!state.dl.shipments.has(awb)) return { packages_found: 0, packages: [] };
    return { packages_found: 1, packages: [{ wbn: awb, pdf_download_link: `http://${headers.host}/files/label-${awb}.pdf` }] };
  }
  if (method === 'POST' && path === '/api/p/edit') {
    const s = state.dl.shipments.get(body.waybill);
    if (!s || s.cancelled) return { status: false, error: 'Shipment not found or already cancelled' };
    s.cancelled = true;
    return { status: true, remark: 'Cancelled' };
  }
  if (method === 'POST' && path === '/fm/request/new/') {
    if (!state.dl.warehouses.has(body.pickup_location)) return dlFail('Pickup location does not exist');
    const key = `${body.pickup_location}|${body.pickup_date}`;
    if (state.dl.pickups.has(key)) return { __http: 400, error: 'Pickup request already exists for this date' };
    state.dl.pickups.add(key);
    return { pickup_id: 4455, incoming_center_name: 'Mock Center', pickup_date: body.pickup_date, pickup_time: body.pickup_time };
  }
  if (method === 'POST' && path === '/api/p/update') {
    const item = body.data?.[0];
    if (!item || !state.dl.shipments.has(item.waybill)) return { success: false, error: 'Waybill not found' };
    state.dl.ndrs.push(item);
    return { success: true, request_id: 'ndr-1' };
  }
  return dlFail(`Mock: no such route ${method} ${path}`, 404);
};

// ---------------- Shiprocket ----------------
const SR_PREFIX = '/shiprocket';
const SR_STEPS = [
  { label: 'PICKUP SCHEDULED', activity: 'Pickup scheduled' },
  { label: 'IN TRANSIT', activity: 'Shipment in transit' },
  { label: 'UNDELIVERED-1ST ATTEMPT', activity: 'Customer not available' },
  { label: 'OUT FOR DELIVERY', activity: 'Out for delivery' },
  { label: 'DELIVERED', activity: 'Delivered to consignee' },
];
const srFail = (message, statusCode = 422, errors) => ({ __http: statusCode, message, ...(errors ? { errors } : {}) });

const shiprocket = (method, rawPath, body, headers) => {
  const [path, qs] = rawPath.replace(SR_PREFIX, '').split('?');
  const q = new URLSearchParams(qs || '');
  if (method === 'POST' && path === '/auth/login') {
    if (body.email !== 'api@x.com' || body.password !== 'sr-pw') return { __http: 403, message: 'Invalid email or password' };
    return { token: 'sr-token', id: 1, email: body.email };
  }
  if (headers.authorization !== 'Bearer sr-token') return { __http: 401, message: 'Unauthenticated.' };

  if (method === 'GET' && path === '/courier/serviceability/') {
    if (bad(q.get('pickup_postcode')) || bad(q.get('delivery_postcode'))) return { __http: 404, status: 404, message: 'No courier serviceable for the given pincodes' };
    if (!q.get('weight')) return srFail('weight is required');
    const cod = q.get('cod') === '1';
    return { status: 200, data: { available_courier_companies: [
      { courier_company_id: 10, courier_name: 'Delhivery Surface 0.5kg', rate: 70 + (cod ? 30 : 0), freight_charge: 70, cod_charges: cod ? 30 : 0, rating: 4.5, estimated_delivery_days: '4', is_surface: true },
      { courier_company_id: 11, courier_name: 'Blue Dart Air', rate: 150, freight_charge: 150, cod_charges: cod ? 35 : 0, rating: 4.8, estimated_delivery_days: '2', is_surface: false },
    ] } };
  }
  if (method === 'GET' && path === '/settings/company/pickup') return { data: { shipping_address: [...state.sr.pickups.values()] } };
  if (method === 'POST' && path === '/settings/company/addpickup') {
    if (!body.email) return srFail('The given data was invalid.', 422, { email: ['The email field is required.'] });
    if (state.sr.pickups.has(body.pickup_location)) return srFail('Pickup location already exists', 422);
    state.sr.pickups.set(body.pickup_location, { pickup_location: body.pickup_location, pin_code: body.pin_code, phone: body.phone });
    return { success: true, address: body };
  }
  if (method === 'POST' && path === '/orders/create/adhoc') {
    const missing = ['order_id', 'pickup_location', 'billing_customer_name', 'billing_address', 'billing_pincode', 'billing_email', 'billing_phone', 'payment_method', 'weight'].filter((k) => !body[k]);
    if (missing.length) return srFail('The given data was invalid.', 422, Object.fromEntries(missing.map((k) => [k, [`The ${k} field is required.`]])));
    if (!state.sr.pickups.has(body.pickup_location)) return srFail('Wrong Pickup location entered', 422);
    if (state.sr.orders.has(body.order_id)) return srFail('The given data was invalid.', 422, { order_id: ['Order id already exists'] });
    const n = ++state.sr.seq;
    state.sr.orders.set(body.order_id, { body, srOrderId: 9000 + n, shipmentId: 7000 + n });
    return { order_id: 9000 + n, shipment_id: 7000 + n, status: 'NEW', status_code: 1, onboarding_completed_now: 0, awb_code: '', courier_company_id: '', courier_name: '' };
  }
  if (method === 'POST' && path === '/courier/assign/awb') {
    if (state.sr.lowWallet) return { awb_assign_status: 0, message: 'Insufficient wallet balance' };
    const entry = [...state.sr.orders.values()].find((o) => o.shipmentId === Number(body.shipment_id));
    if (!entry) return srFail('Shipment not found', 404);
    const awb = `SR${String(entry.shipmentId).padStart(9, '0')}`;
    state.sr.shipments.set(awb, { polls: 0, cancelled: false, shipmentId: entry.shipmentId, courierId: body.courier_id || 10 });
    return { awb_assign_status: 1, response: { data: { courier_company_id: body.courier_id || 10, awb_code: awb, cod: 0, order_id: entry.srOrderId, shipment_id: entry.shipmentId, courier_name: body.courier_id === 11 ? 'Blue Dart Air' : 'Delhivery Surface 0.5kg' } } };
  }
  if (method === 'POST' && path === '/courier/generate/pickup') {
    const id = body.shipment_id?.[0];
    if (state.sr.pickupCalls.has(id)) return srFail('Pickup already scheduled for this shipment', 400);
    state.sr.pickupCalls.add(id);
    return { pickup_status: 1, response: { pickup_scheduled_date: '2030-01-02 10:00:00' } };
  }
  if (method === 'POST' && path === '/manifests/generate') {
    const sh = [...state.sr.shipments.entries()].find(([, v]) => v.shipmentId === Number(body.shipment_id?.[0]));
    if (!sh) return srFail('Shipment not found', 404);
    return { status: 1, manifest_url: `http://${headers.host}/files/manifest-${sh[0]}.pdf` };
  }
  if (method === 'POST' && path === '/courier/generate/label') {
    const sh = [...state.sr.shipments.entries()].find(([, v]) => v.shipmentId === Number(body.shipment_id?.[0]));
    if (!sh) return { label_created: 0, response: 'Label could not be generated' };
    return { label_created: 1, label_url: `http://${headers.host}/files/label-${sh[0]}.pdf`, response: 'Label has been created successfully!', not_created: [] };
  }
  if (method === 'GET' && path.startsWith('/courier/track/awb/')) {
    const awb = decodeURIComponent(path.split('/').pop());
    const sh = state.sr.shipments.get(awb);
    if (!sh) return { tracking_data: { track_status: 0, shipment_status: 0, error: 'Tracking data not available' } };
    const idx = Math.min(sh.polls++, SR_STEPS.length - 1);
    const now = Date.now();
    const status = sh.cancelled ? 'CANCELED' : SR_STEPS[idx].label;
    const acts = SR_STEPS.slice(0, idx + 1).map((st, i) => ({ date: new Date(now - (idx - i) * 3600000).toISOString(), status: 1, activity: st.activity, location: 'Gurgaon', 'sr-status': 6, 'sr-status-label': st.label })).reverse();
    return { tracking_data: { track_status: 1, shipment_status: idx + 1, shipment_track: [{ awb_code: awb, current_status: status, courier_name: 'Mock' }], shipment_track_activities: acts } };
  }
  if (method === 'POST' && path === '/orders/cancel/shipment/awbs') {
    const sh = state.sr.shipments.get(body.awbs?.[0]);
    if (!sh || sh.cancelled) return srFail('AWB not found or already cancelled', 400);
    sh.cancelled = true;
    return { message: 'Bulk Shipment cancellation is in progress. Please wait for 5 minutes' };
  }
  if (method === 'POST' && path === '/orders/cancel') {
    state.sr.cancelledOrders.push(...(body.ids || []));
    return { message: 'Order cancelled successfully.' };
  }
  if (method === 'POST' && path.startsWith('/ndr/') && path.endsWith('/action')) {
    const awb = decodeURIComponent(path.split('/')[2]);
    if (!state.sr.shipments.has(awb)) return srFail('AWB not found', 404);
    if (!['re-attempt', 'return'].includes(body.action)) return srFail('Invalid action', 422);
    state.sr.ndrs.push({ awb, ...body });
    return { status: true, message: 'NDR action submitted' };
  }
  return srFail(`Mock: no such route ${method} ${path}`, 404);
};

// ---------------- server ----------------
const pdf = (text) => Buffer.from(
  `%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n` +
  `3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n` +
  `4 0 obj<</Length ${text.length + 40}>>stream\nBT /F1 14 Tf 20 100 Td (${text}) Tj ET\nendstream endobj\n` +
  `5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF`
);

const server = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (d) => (raw += d));
  req.on('end', () => {
    const path = req.url.split('?')[0];
    const file = path.match(/^\/files\/(label|manifest)-(.+)\.pdf$/);
    if (file) {
      res.setHeader('Content-Type', 'application/pdf');
      return res.end(pdf(`MOCK ${file[1].toUpperCase()} - AWB ${file[2]}`));
    }
    if (req.method === 'POST' && path === `${EK_PREFIX}/api/v1/package/label`) {
      console.log(`POST ${path} -> ok (pdf)`);
      res.setHeader('Content-Type', 'application/octet-stream');
      return res.end(pdf('MOCK EKART LABEL'));
    }
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { /* ignore */ }
    const form = (req.headers['content-type'] || '').includes('urlencoded') ? Object.fromEntries(new URLSearchParams(raw)) : {};
    let out;
    if (req.url.startsWith(SR_PREFIX)) out = shiprocket(req.method, req.url, body, req.headers);
    else if (req.url.startsWith(DL_PREFIX)) out = delhivery(req.method, req.url, body, req.headers, form);
    else if (req.url.startsWith(EK_PREFIX)) out = ekart(req.method, req.url, body, req.headers);
    else if (req.url.startsWith(SM_PREFIX)) out = shipmozo(req.method, req.url, body, req.headers, req.headers.host);
    else out = xpressbees(req.method, path, body, req.headers.host);
    const httpStatus = out.__http || 200;
    if (out.__http) delete out.__http;
    const good = httpStatus === 200 && (Array.isArray(out) || out.success === true || out.ShipmentData || out.delivery_codes || out.pickup_id || out.status === true || out.result === '1' || out.access_token || out.track || out.data || out.manifestDownloadUrl || out.token || out.awb_assign_status === 1 || out.tracking_data || out.shipment_id || out.label_created === 1 || out.message);
    console.log(`${req.method} ${req.url.split('?')[0]} -> ${good ? 'ok' : `FAIL (${out.message || out.remark})`}`);
    res.statusCode = httpStatus;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(out));
  });
});

module.exports = { server, state };

if (require.main === module) {
  const PORT = process.env.MOCK_PORT || 5055;
  server.listen(PORT, () => console.log(`Mock couriers running. Xpressbees: http://localhost:${PORT}/api  Shipmozo: http://localhost:${PORT}${SM_PREFIX}  Ekart: http://localhost:${PORT}${EK_PREFIX}  Delhivery: http://localhost:${PORT}${DL_PREFIX}  Shiprocket: http://localhost:${PORT}${SR_PREFIX}`));
}
