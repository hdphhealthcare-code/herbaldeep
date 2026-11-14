const assert = require('assert');
const { server, state: mock } = require('./mockShippingServer');

server.listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  process.env.XPRESSBEES_BASE_URL = `${base}/api/`; // trailing slash on purpose
  process.env.XPRESSBEES_EMAIL = 'me@x.com';
  process.env.XPRESSBEES_PASSWORD = 'pw';
  process.env.SHIPMOZO_BASE_URL = `${base}/app/api/v1`;
  process.env.SHIPMOZO_PUBLIC_KEY = 'pub';
  process.env.SHIPMOZO_PRIVATE_KEY = 'priv';
  Object.assign(process.env, {
    EKART_BASE_URL: `${base}/ekart`, EKART_CLIENT_ID: 'cid', EKART_USERNAME: 'u', EKART_PASSWORD: 'p',
    EKART_SELLER_NAME: 'Herbal Deep', EKART_SELLER_ADDRESS: 'Plot 1, Gurgaon', EKART_SELLER_GST_TIN: '06ABCDE1234F1Z5', EKART_GST_PERCENT: '12',
  });

  Object.assign(process.env, { DELHIVERY_BASE_URL: `${base}/delhivery`, DELHIVERY_API_TOKEN: 'dl-token' });
  Object.assign(process.env, { SHIPROCKET_BASE_URL: `${base}/shiprocket`, SHIPROCKET_EMAIL: 'api@x.com', SHIPROCKET_PASSWORD: 'sr-pw' });

  const Warehouse = require('../src/models/Warehouse');
  const wh = {
    _id: 'wh1', active: true, title: 'Main WH', name: 'Ravi', phone: '+91 99999-88888', address: '140 MG Road',
    city: 'Gurgaon', state: 'Haryana', pincode: '122001', providerIds: {}, markModified() {}, async save() {},
  };
  Warehouse.findById = async () => wh;
  const registry = require('../src/services/shipping');
  const svc = require('../src/services/orderShippingService');

  const newOrder = () => ({
    orderId: 'ORD-000001', orderDate: new Date(), totalAmount: 500, status: 'confirmed',
    items: [{ name: 'BP Monitor', sku: 'BPM-01', price: 500, quantity: 1 }],
    statusHistory: [], courier: {}, shipping: { status: 'not_pushed' }, save: async function () { return this; },
  });
  const customer = { name: 'Asha', mobile: '+91 98765-43210', address: 'Sec 49', area: 'Near park', city: 'Gurgaon', state: 'Haryana', pincode: '110001' };
  const user = { _id: 'u1' };
  const parcel = { warehouseId: 'wh1', weight: 200, length: 10, width: 20, height: 15 };

  // ---- registry ----
  assert.deepEqual(registry.list().map((p) => [p.id, p.configured]), [['xpressbees', true], ['shipmozo', true], ['ekart', true], ['delhivery', true], ['shiprocket', true]]);
  assert.deepEqual(registry.list().map((p) => p.label), ['Xpressbees', 'Shipmozo', 'Ekart', 'Delhivery', 'Shiprocket'], 'display names survive (label() methods must not clash)');
  assert.equal(registry.get('shipmozo').capabilities.manifest, false);
  assert.throws(() => registry.get('nope'), /Unknown courier/);

  // ---- status of both ----
  assert.equal((await registry.get('xpressbees').status()).online, true);
  const smStatus = await registry.get('shipmozo').status();
  assert.equal(smStatus.online, true);
  const dlStatus = await registry.get('delhivery').status();
  assert.equal(dlStatus.online, true); assert.match(dlStatus.message, /token accepted/i);
  const ekStatus = await registry.get('ekart').status();
  assert.equal(ekStatus.online, true); assert.ok(!/will fail/.test(ekStatus.message), 'seller details are set');

  // ---- compare rates: both couriers in one call; one failing does not hide the other ----
  let groups = await svc.getRates(newOrder(), customer, parcel);
  assert.deepEqual(groups.map((g) => [g.provider, g.label, g.couriers.length]), [['xpressbees', 'Xpressbees', 3], ['shipmozo', 'Shipmozo', 2], ['ekart', 'Ekart', 2], ['delhivery', 'Delhivery', 2], ['shiprocket', 'Shiprocket', 2]]);
  assert.equal(groups[1].couriers[1].autoPickup, false);
  assert.equal(groups[1].couriers[0].autoPickup, true);
  groups = await svc.getRates(newOrder(), { ...customer, pincode: '000111' }, parcel);
  assert.ok(groups.every((g) => g.couriers.length === 0), 'no courier serves the bad pincode');
  assert.ok(/not serviceable/i.test(groups[0].error) && /not serviceable/i.test(groups[1].error), 'errors are reported per courier');
  assert.ok(/serviceable/i.test(groups.find((g) => g.provider === 'shiprocket').error), 'Shiprocket 404 reads as a readable error');
  const ekRates = (await svc.getRates(newOrder(), customer, { ...parcel, providers: ['ekart'] }))[0].couriers;
  assert.deepEqual(ekRates.map((c) => c.id), ['SURFACE', 'EXPRESS']);
  assert.ok(ekRates[0].rate < ekRates[1].rate && ekRates[0].eta === '3-5 days');
  groups = await svc.getRates(newOrder(), customer, { ...parcel, providers: ['shipmozo'] });
  assert.equal(groups.length, 1);

  // ================= SHIPMOZO flow =================
  let order = newOrder();
  await assert.rejects(svc.book(order, { ...customer, pincode: '' }, { ...parcel, provider: 'shipmozo' }, user), /pincode/);
  // no courier chosen -> cheapest (Professional, needs schedule-pickup)
  let r = await svc.book(order, customer, { ...parcel, provider: 'shipmozo' }, user);
  assert.equal(r.result.providerLabel, 'Shipmozo');
  assert.equal(order.shipping.provider, 'shipmozo');
  assert.equal(order.shipping.courierName, 'Professional 0.5KG');
  assert.ok(/^SM\d+$/.test(order.shipping.awb), 'AWB came from schedule-pickup');
  assert.equal(order.shipping.lrNumber, '58930303');
  assert.equal(order.shipping.providerOrderId, 'ORD-000001');
  assert.equal(wh.providerIds.shipmozo, '23481', 'warehouse was created on Shipmozo once and remembered');
  assert.equal(order.status, 'ready_for_dispatch');
  assert.equal(order.courier.awb, order.shipping.awb);
  await assert.rejects(svc.book(order, customer, { ...parcel, provider: 'shipmozo' }, user), /already booked/);

  // track advances and syncs order status
  await svc.track(order, user); assert.equal(order.shipping.lastTrackStatus, 'Pickup Pending');
  await svc.track(order, user); assert.equal(order.status, 'in_transit');
  r = await svc.track(order, user); assert.equal(order.status, 'delivered');
  assert.equal(r.result.history[0].message, 'Delivered');

  // label is a data URL, manifest is not supported
  const label = await svc.label(order);
  assert.equal(label.type, 'dataUrl'); assert.ok(label.label.startsWith('data:image/png;base64,'));
  await assert.rejects(svc.manifest(order, user), /no manifest API/);

  // return (reason list + push + best-effort courier)
  assert.equal((await registry.get('shipmozo').returnReasons())[0].id, 9);
  await assert.rejects(svc.pushReturn(order, customer, {}, user), /return reason/);
  r = await svc.pushReturn(order, customer, { returnReasonId: 9 }, user);
  assert.equal(order.shipping.returnPushed, true);
  assert.ok(r.result.returnAwb, 'return got a courier + AWB');

  // a delivered parcel cannot be cancelled; before pickup it can
  await assert.rejects(svc.cancel(order, user), /already picked/);
  order.status = 'ready_for_dispatch';
  // cancel, then rebook with a fresh reference (Shipmozo rejects duplicate order ids)
  await svc.cancel(order, user);
  assert.equal(order.status, 'confirmed', 'cancelled shipment sends the order back to "confirmed", so it can be shipped again');
  assert.equal(order.shipping.status, 'cancelled'); assert.equal(order.shipping.awb, undefined); assert.equal(order.shipping.attempts, 1);
  r = await svc.book(order, customer, { ...parcel, provider: 'shipmozo', courierId: '1' }, user);
  assert.equal(order.shipping.providerOrderId, 'ORD-000001-B1');
  assert.equal(order.shipping.courierName, 'Delhivery');
  assert.ok(/^SM\d+$/.test(order.shipping.awb), 'auto-pickup courier: AWB read from order detail');
  await assert.rejects(svc.book(newOrder(), customer, { ...parcel, provider: 'shipmozo', courierId: '99' }, user), /no longer available/);

  // ================= XPRESSBEES flow =================
  order = newOrder();
  r = await svc.book(order, customer, { ...parcel, provider: 'xpressbees', paymentType: 'COD' }, user);
  assert.equal(order.shipping.provider, 'xpressbees'); assert.equal(order.shipping.paymentType, 'COD');
  assert.equal(order.shipping.codAmount, 500);
  assert.ok(order.shipping.awb.startsWith('1434494')); assert.ok(order.shipping.labelUrl.endsWith('.pdf'));
  assert.equal((await svc.label(order)).type, 'url');
  await svc.manifest(order, user); assert.ok(order.shipping.manifestUrl);
  await svc.track(order, user); await svc.track(order, user); await svc.track(order, user);
  assert.equal(order.status, 'delivered');
  r = await svc.pushReturn(order, customer, {}, user); assert.ok(order.shipping.returnAwb);
  order.status = 'ready_for_dispatch';
  await svc.cancel(order, user); assert.equal(order.shipping.status, 'cancelled');
  await assert.rejects(svc.cancel(order, user), /not booked/);
  assert.equal((await registry.get('xpressbees').ndrCreate([{ awb: '1', action: 're-attempt', action_data: {} }]))[0].status, true);


  // ================= EKART flow =================
  order = newOrder();
  await assert.rejects(svc.book(order, customer, { ...parcel, provider: 'ekart', paymentType: 'COD', codAmount: 60000 }, user), /COD up to/);
  r = await svc.book(order, customer, { ...parcel, provider: 'ekart' }, user); // Auto = Surface
  assert.equal(order.shipping.provider, 'ekart'); assert.equal(order.shipping.courierId, 'SURFACE');
  assert.match(order.shipping.courierName, /Ekart Surface/);
  assert.ok(/^EK\d+$/.test(order.shipping.awb), 'tracking_id is the AWB');
  assert.equal(wh.providerIds.ekart, 'Main WH', 'pickup address was registered once and remembered');
  assert.equal(order.status, 'ready_for_dispatch');
  // express + COD on a second order reuses the registered alias
  const o2 = newOrder(); o2.orderId = 'ORD-000002';
  await svc.book(o2, customer, { ...parcel, provider: 'ekart', courierId: 'EXPRESS', paymentType: 'COD' }, user);
  assert.equal(o2.shipping.courierId, 'EXPRESS'); assert.equal(o2.shipping.codAmount, 500);
  // track: Pickup Scheduled -> In Transit (+ NDR) -> Delivered
  r = await svc.track(order, user);
  assert.equal(order.shipping.lastTrackStatus, 'Pickup Scheduled'); assert.equal(order.status, 'ready_for_dispatch');
  r = await svc.track(order, user);
  assert.equal(order.status, 'in_transit'); assert.deepEqual(r.result.ndr.actions, ['Re-Attempt', 'RTO']);
  assert.match(r.result.history[0].message, /In Transit - Shipment in transit/);
  // NDR action (validated before the call)
  await assert.rejects(svc.ndrAction(order, { action: 'Nope' }, user), /Re-Attempt or RTO/);
  await assert.rejects(svc.ndrAction(order, { action: 'Re-Attempt', date: '2000-01-01' }, user), /next 7 days/);
  const tomorrow = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  r = await svc.ndrAction(order, { action: 'Re-Attempt', date: tomorrow, phone: '9876543210', instructions: 'Call first' }, user);
  assert.match(r.result.remark, /Re-Attempt submitted/);
  r = await svc.track(order, user); assert.equal(order.status, 'delivered');
  // label is a PDF data URL, manifest is a link
  const ekLabel = await svc.label(order);
  assert.equal(ekLabel.type, 'dataUrl'); assert.ok(ekLabel.label.startsWith('data:application/pdf;base64,'));
  assert.equal(Buffer.from(ekLabel.label.split(',')[1], 'base64').subarray(0, 4).toString(), '%PDF');
  await svc.manifest(order, user); assert.match(order.shipping.manifestUrl, /manifest-EK/);
  // reverse pickup uses payment_mode Pickup + reason
  r = await svc.pushReturn(order, customer, { reason: 'Item is damaged' }, user);
  assert.ok(/^EK\d+$/.test(order.shipping.returnAwb));
  // Xpressbees-only NDR guard
  await assert.rejects(svc.ndrAction(Object.assign(newOrder(), { shipping: { status: 'booked', provider: 'shipmozo', awb: 'x' } }), { action: 'RTO' }, user), /NDR/);
  // cancel + rebook gets a fresh reference
  order.status = 'ready_for_dispatch';
  await svc.cancel(order, user); assert.equal(order.shipping.status, 'cancelled'); assert.equal(order.shipping.attempts, 1);
  await svc.book(order, customer, { ...parcel, provider: 'ekart' }, user);
  assert.equal(order.shipping.providerOrderId, 'ORD-000001-B1');
  // seller details missing -> clear error, nothing booked
  const cfgEnv = require('../src/config/env');
  const gst = cfgEnv.ekart.sellerGstTin; cfgEnv.ekart.sellerGstTin = '';
  await assert.rejects(svc.book(newOrder(), customer, { ...parcel, provider: 'ekart' }, user), /EKART_SELLER_GST_TIN/);
  assert.match((await registry.get('ekart').status()).message, /EKART_SELLER_GST_TIN/);
  cfgEnv.ekart.sellerGstTin = gst;


  // ================= DELHIVERY flow =================
  const dlProv = registry.get('delhivery');
  assert.deepEqual([dlProv.capabilities.manifest, dlProv.capabilities.returnReasons, dlProv.capabilities.courierList], [true, false, false]);
  // rates: Surface + Express with delivery days; COD adds the COD charge
  const dlRates = (await svc.getRates(newOrder(), customer, { ...parcel, providers: ['delhivery'] }))[0].couriers;
  assert.deepEqual(dlRates.map((c) => [c.id, c.name, c.rate, c.eta]), [['S', 'Delhivery Surface', 68, '4 days'], ['E', 'Delhivery Express', 103, '2 days']]);
  assert.deepEqual(dlRates.map((c) => c.mode), ['surface', 'air'], 'Express shows in the Air tab');
  const dlCod = (await svc.getRates(newOrder(), customer, { ...parcel, providers: ['delhivery'], paymentType: 'COD' }))[0].couriers;
  assert.equal(dlCod[0].rate, 98); assert.equal(dlCod[0].cod, 30);
  // pincode checks: not serviceable, COD not available
  let dlBad = await svc.getRates(newOrder(), { ...customer, pincode: '000111' }, { ...parcel, providers: ['delhivery'] });
  assert.match(dlBad[0].error, /not serviceable/);
  dlBad = await svc.getRates(newOrder(), { ...customer, pincode: '110002' }, { ...parcel, providers: ['delhivery'], paymentType: 'COD' });
  assert.match(dlBad[0].error, /COD is not available/);
  assert.equal((await dlProv.serviceability({ origin: '122001', destination: '110001' })).serviceable, true);
  assert.equal((await dlProv.serviceability({ origin: '122001', destination: '000111' })).serviceable, false);

  // book (Auto = Surface). The pickup location is registered once and remembered
  order = newOrder();
  await assert.rejects(svc.book(order, { ...customer, pincode: '' }, { ...parcel, provider: 'delhivery' }, user), /pincode/);
  r = await svc.book(order, customer, { ...parcel, provider: 'delhivery' }, user);
  assert.equal(order.shipping.provider, 'delhivery'); assert.equal(order.shipping.courierId, 'S');
  assert.equal(order.shipping.courierName, 'Delhivery Surface'); assert.equal(order.shipping.mode, 'surface');
  assert.ok(/^DL\d+$/.test(order.shipping.awb), 'waybill is the AWB');
  assert.equal(wh.providerIds.delhivery, 'Main WH'); assert.ok(mock.dl.warehouses.has('Main WH'));
  assert.equal(order.status, 'ready_for_dispatch'); assert.equal(order.courier.awb, order.shipping.awb);
  assert.equal(mock.dl.shipments.get(order.shipping.awb).weight, '200', 'weight is sent in grams');
  await assert.rejects(svc.book(order, customer, { ...parcel, provider: 'delhivery' }, user), /already booked/);
  // Express + COD on a second order reuses the registered location
  const dl2 = newOrder(); dl2.orderId = 'ORD-000002';
  await svc.book(dl2, customer, { ...parcel, provider: 'delhivery', courierId: 'E', paymentType: 'COD' }, user);
  assert.equal(dl2.shipping.courierId, 'E'); assert.equal(dl2.shipping.codAmount, 500); assert.equal(dl2.shipping.mode, 'air');
  assert.equal(mock.dl.shipments.get(dl2.shipping.awb).mode, 'Express'); assert.equal(mock.dl.shipments.get(dl2.shipping.awb).payment, 'COD');
  // Delhivery refusing the booking: its reason reaches the user, nothing is stored
  const dup = newOrder(); // same reference as the first order
  await assert.rejects(svc.book(dup, customer, { ...parcel, provider: 'delhivery' }, user), /Duplicate order id/);
  assert.equal(dup.shipping.status, 'not_pushed');

  // live tracking: Manifested -> In Transit -> Pending(consignee unavailable) = NDR -> Dispatched = out for delivery -> Delivered
  r = await svc.track(order, user); assert.equal(order.shipping.lastTrackStatus, 'Manifested'); assert.equal(order.status, 'ready_for_dispatch');
  r = await svc.track(order, user); assert.equal(order.status, 'in_transit');
  assert.match(r.result.history[0].message, /In Transit - Shipment in transit/);
  r = await svc.track(order, user); assert.equal(order.status, 'ndr'); assert.deepEqual(r.result.ndr.actions, ['Re-Attempt']);
  // NDR action: re-attempt (optionally deferred), RTO is automatic
  await assert.rejects(svc.ndrAction(order, { action: 'RTO' }, user), /return-to-origin/);
  await svc.ndrAction(order, { action: 'Re-Attempt' }, user);
  assert.equal(mock.dl.ndrs.at(-1).act, 'RE-ATTEMPT');
  await svc.ndrAction(order, { action: 'Re-Attempt', date: '2030-01-05' }, user);
  assert.deepEqual([mock.dl.ndrs.at(-1).act, mock.dl.ndrs.at(-1).action_data.deferred_date], ['DEFER_DLV', '2030-01-05']);
  r = await svc.track(order, user); assert.equal(order.status, 'out_for_delivery');
  r = await svc.track(order, user); assert.equal(order.status, 'delivered');

  // label is a link, pickup request ("manifest") can be repeated without an error
  const dlLabel = await svc.label(order); assert.equal(dlLabel.type, 'url'); assert.match(dlLabel.label, /label-DL/);
  await svc.manifest(order, user); assert.ok(order.shipping.manifestedAt, 'pickup requested -> Ready to pickup');
  await svc.manifest(order, user);
  // returns are not enabled: clear message, no wrong shipment created
  await assert.rejects(svc.pushReturn(order, customer, {}, user), /not available from the CRM/);
  // cancel before pickup, then rebook with a fresh reference
  order.status = 'ready_for_dispatch';
  await svc.cancel(order, user); assert.equal(order.shipping.status, 'cancelled'); assert.equal(order.shipping.attempts, 1);
  await assert.rejects(svc.cancel(order, user), /not booked/);
  await svc.book(order, customer, { ...parcel, provider: 'delhivery' }, user);
  assert.equal(order.shipping.providerOrderId, 'ORD-000001-B1');
  // push webhook format
  const hook = dlProv.fromWebhook({ Shipment: { AWB: 'DL1', Status: { Status: 'Dispatched', StatusType: 'UD', StatusLocation: 'Delhi', StatusDateTime: '2030-01-01T10:00:00', Instructions: 'Out for delivery' } } });
  assert.deepEqual([hook.awb, hook.status, hook.history[0].location], ['DL1', 'Out For Delivery', 'Delhi']);
  assert.equal(dlProv.fromWebhook({ nothing: 1 }), null);
  // wrong token: reported as an error of Delhivery (never a CRM 401), booking stays untouched
  const envCfg = require('../src/config/env');
  const goodToken = envCfg.delhivery.token; envCfg.delhivery.token = 'wrong';
  const bad401 = await dlProv.status(); assert.equal(bad401.online, false); assert.match(bad401.message, /rejected the API token/);
  await assert.rejects(svc.book(newOrder(), customer, { ...parcel, provider: 'delhivery' }, user), (e) => e.statusCode !== 401 && /rejected the API token/.test(e.message));
  envCfg.delhivery.token = goodToken;

  // =================== Shiprocket ===================
  const srProv = registry.get('shiprocket');
  assert.equal((await srProv.status()).online, true);
  assert.ok(srProv.capabilities.ndrRto && srProv.capabilities.manifest);
  // rates: courier list with mode / rating / days; COD adds the COD charge
  const srRates = (await svc.getRates(newOrder(), customer, { ...parcel, providers: ['shiprocket'] }))[0].couriers;
  assert.deepEqual(srRates.map((c) => [c.id, c.mode, c.rate]), [['10', 'surface', 70], ['11', 'air', 150]]);
  assert.equal(srRates[0].etaDays, 4); assert.equal(srRates[1].rating, 4.8);
  const srCod = (await svc.getRates({ ...newOrder(), payment: { type: 'COD', codAmount: 500 } }, customer, { ...parcel, providers: ['shiprocket'] }))[0].couriers;
  assert.equal(srCod[0].rate, 100, 'COD charge is added');
  assert.equal((await srProv.serviceability({ origin: '122001', destination: '000111' })).serviceable, false);
  assert.equal((await srProv.serviceability({ origin: '122001', destination: '110001' })).serviceable, true);

  // book the chosen courier: pickup address registered once (with an email), order + AWB in one go
  order = newOrder();
  await assert.rejects(svc.book(order, { ...customer, pincode: '' }, { ...parcel, provider: 'shiprocket' }, user), /pincode/);
  r = await svc.book(order, customer, { ...parcel, provider: 'shiprocket', courierId: '11' }, user);
  assert.equal(order.shipping.provider, 'shiprocket'); assert.equal(order.shipping.courierId, '11');
  assert.equal(order.shipping.courierName, 'Blue Dart Air'); assert.equal(order.shipping.mode, 'air');
  assert.ok(/^SR\d+$/.test(order.shipping.awb)); assert.ok(order.shipping.shipmentId); assert.ok(order.shipping.xbOrderId, 'Shiprocket order id kept for cancel');
  assert.equal(wh.providerIds.shiprocket, 'Main WH'); assert.ok(mock.sr.pickups.has('Main WH'));
  assert.equal(order.status, 'ready_for_dispatch'); assert.equal(order.courier.awb, order.shipping.awb);
  const srSent = mock.sr.orders.get('ORD-000001').body;
  assert.equal(srSent.weight, 0.2, 'grams are sent as kg'); assert.equal(srSent.payment_method, 'Prepaid'); assert.equal(srSent.billing_phone, '9876543210');
  assert.equal(srSent.order_items[0].selling_price, 500); assert.equal(srSent.sub_total, 500); assert.equal(srSent.billing_email, 'api@x.com', 'fallback email when the customer has none');
  await assert.rejects(svc.book(order, customer, { ...parcel, provider: 'shiprocket' }, user), /already booked/);
  // auto (no courier id) + COD with a custom COD amount
  const sr2 = newOrder(); sr2.orderId = 'ORD-000002'; sr2.payment = { type: 'COD', codAmount: 450 };
  await svc.book(sr2, customer, { ...parcel, provider: 'shiprocket', paymentType: 'COD', codAmount: 450 }, user);
  assert.equal(sr2.shipping.codAmount, 450);
  const sr2Sent = mock.sr.orders.get('ORD-000002').body;
  assert.deepEqual([sr2Sent.payment_method, sr2Sent.total_discount], ['COD', 50], 'a lower COD amount becomes a discount so Shiprocket collects exactly that');
  // wallet empty: the reason reaches the user and the half-made Shiprocket order is cancelled, nothing stored
  mock.sr.lowWallet = true;
  const sr3 = newOrder(); sr3.orderId = 'ORD-000003';
  await assert.rejects(svc.book(sr3, customer, { ...parcel, provider: 'shiprocket' }, user), /Insufficient wallet/);
  assert.equal(sr3.shipping.status, 'not_pushed'); assert.equal(mock.sr.cancelledOrders.length, 1);
  mock.sr.lowWallet = false;
  // Shiprocket refusing the order itself (duplicate reference) shows its reason
  const srDup = newOrder();
  await assert.rejects(svc.book(srDup, customer, { ...parcel, provider: 'shiprocket' }, user), /Order id already exists/);

  // live tracking: pickup scheduled -> in transit -> undelivered = NDR -> out for delivery -> delivered
  r = await svc.track(order, user); assert.equal(order.shipping.lastTrackStatus, 'PICKUP SCHEDULED'); assert.equal(order.status, 'ready_for_dispatch');
  r = await svc.track(order, user); assert.equal(order.status, 'in_transit');
  r = await svc.track(order, user); assert.equal(order.status, 'ndr'); assert.deepEqual(r.result.ndr.actions, ['Re-Attempt', 'RTO']);
  assert.match(r.result.history[0].message, /UNDELIVERED/);
  // NDR actions go to Shiprocket: re-attempt needs a date, RTO becomes "return"
  await assert.rejects(svc.ndrAction(order, { action: 'Re-Attempt' }, user), /re-attempt date/);
  await svc.ndrAction(order, { action: 'Re-Attempt', date: '2030-01-05', instructions: 'Call before delivery', phone: '9000000001' }, user);
  assert.deepEqual([mock.sr.ndrs.at(-1).action, mock.sr.ndrs.at(-1).deferred_date, mock.sr.ndrs.at(-1).phone], ['re-attempt', '2030-01-05', '9000000001']);
  await svc.ndrAction(order, { action: 'RTO' }, user); assert.equal(mock.sr.ndrs.at(-1).action, 'return');
  assert.ok(order.shipping.ndr.lastAction, 'the last NDR action is remembered');
  r = await svc.track(order, user); assert.equal(order.status, 'out_for_delivery');
  r = await svc.track(order, user); assert.equal(order.status, 'delivered');
  // label = link, manifest asks for the pickup first and can be repeated
  const srLabel = await svc.label(order); assert.equal(srLabel.type, 'url'); assert.match(srLabel.label, /label-SR/);
  const mf = await svc.manifest(order, user); assert.match(mf.result.manifest, /manifest-SR/); assert.ok(order.shipping.manifestedAt);
  await svc.manifest(order, user);
  await assert.rejects(svc.pushReturn(order, customer, {}, user), /not available from the CRM/);
  // cancel before pickup (shipment + order), then rebook with a fresh reference
  order.status = 'ready_for_dispatch';
  await svc.cancel(order, user); assert.equal(order.shipping.status, 'cancelled'); assert.equal(order.shipping.attempts, 1);
  await svc.book(order, customer, { ...parcel, provider: 'shiprocket' }, user);
  assert.equal(order.shipping.providerOrderId, 'ORD-000001-B1');
  // webhook format: awb + current_status are found by the shared webhook reader
  const { deepFind } = require('../src/services/shipping/common');
  assert.deepEqual([deepFind({ awb: 'SR1', current_status: 'DELIVERED', order_id: '1' }, ['awb', 'awb_number']), deepFind({ current_status: 'DELIVERED' }, ['current_status'])], ['SR1', 'DELIVERED']);
  // wrong login: a Shiprocket error (never a CRM 401)
  const srCfg = require('../src/config/env').shiprocket; const srGood = srCfg.password;
  require('../src/services/shiprocketClient').resetToken(); srCfg.password = 'wrong';
  const srBad = await srProv.status(); assert.equal(srBad.online, false); assert.match(srBad.message, /login failed/i);
  await assert.rejects(svc.book(newOrder(), customer, { ...parcel, provider: 'shiprocket' }, user), (e) => e.statusCode !== 401 && /login failed/i.test(e.message));
  srCfg.password = srGood; require('../src/services/shiprocketClient').resetToken();

  // orders booked before Shipmozo existed (no provider stored) still behave as Xpressbees
  order = newOrder();
  await svc.book(order, customer, { ...parcel, provider: 'xpressbees' }, user);
  order.shipping.provider = undefined;
  await svc.track(order, user); assert.equal(order.shipping.lastTrackStatus, 'pending pickup');

  // provider not configured -> clear error, nothing booked
  const smClient = require('../src/services/shipmozoClient');
  const env = require('../src/config/env');
  env.shipmozo.publicKey = '';
  assert.equal(smClient.isConfigured(), false);
  await assert.rejects(svc.book(newOrder(), customer, { ...parcel, provider: 'shipmozo' }, user), /not configured/);
  groups = await svc.getRates(newOrder(), customer, parcel);
  assert.deepEqual(groups.map((g) => g.provider), ['xpressbees', 'ekart', 'delhivery', 'shiprocket'], 'unconfigured courier is skipped in compare');

  console.log('ALL SHIPPING TESTS PASSED');
  server.close();
});
