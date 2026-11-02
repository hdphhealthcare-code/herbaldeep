const assert = require('assert');
const { server } = require('./mockShippingServer');

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
    EKART_SELLER_NAME: 'Fusse Seller', EKART_SELLER_ADDRESS: 'Plot 1, Gurgaon', EKART_SELLER_GST_TIN: '06ABCDE1234F1Z5', EKART_GST_PERCENT: '12',
  });

  const Warehouse = require('../src/models/Warehouse');
  const wh = {
    _id: 'wh1', active: true, title: 'Main WH', name: 'Ravi', phone: '+91 99999-88888', address: '140 MG Road',
    city: 'Gurgaon', state: 'Haryana', pincode: '122001', providerIds: {}, markModified() {}, async save() {},
  };
  Warehouse.findById = async () => wh;
  const registry = require('../src/services/shipping');
  const svc = require('../src/services/orderShippingService');

  const newOrder = () => ({
    orderId: 'ORD-000001', orderDate: new Date(), totalAmount: 500, status: 'agent_assigned',
    items: [{ name: 'BP Monitor', sku: 'BPM-01', price: 500, quantity: 1 }],
    statusHistory: [], courier: {}, shipping: { status: 'not_pushed' }, save: async function () { return this; },
  });
  const customer = { name: 'Asha', mobile: '+91 98765-43210', address: 'Sec 49', area: 'Near park', city: 'Gurgaon', state: 'Haryana', pincode: '110001' };
  const user = { _id: 'u1' };
  const parcel = { warehouseId: 'wh1', weight: 200, length: 10, width: 20, height: 15 };

  // ---- registry ----
  assert.deepEqual(registry.list().map((p) => [p.id, p.configured]), [['xpressbees', true], ['shipmozo', true], ['ekart', true]]);
  assert.deepEqual(registry.list().map((p) => p.label), ['Xpressbees', 'Shipmozo', 'Ekart'], 'display names survive (label() methods must not clash)');
  assert.equal(registry.get('shipmozo').capabilities.manifest, false);
  assert.throws(() => registry.get('nope'), /Unknown courier/);

  // ---- status of both ----
  assert.equal((await registry.get('xpressbees').status()).online, true);
  const smStatus = await registry.get('shipmozo').status();
  assert.equal(smStatus.online, true);
  const ekStatus = await registry.get('ekart').status();
  assert.equal(ekStatus.online, true); assert.ok(!/will fail/.test(ekStatus.message), 'seller details are set');

  // ---- compare rates: both couriers in one call; one failing does not hide the other ----
  let groups = await svc.getRates(newOrder(), customer, parcel);
  assert.deepEqual(groups.map((g) => [g.provider, g.label, g.couriers.length]), [['xpressbees', 'Xpressbees', 3], ['shipmozo', 'Shipmozo', 2], ['ekart', 'Ekart', 2]]);
  assert.equal(groups[1].couriers[1].autoPickup, false);
  assert.equal(groups[1].couriers[0].autoPickup, true);
  groups = await svc.getRates(newOrder(), { ...customer, pincode: '000111' }, parcel);
  assert.ok(groups.every((g) => g.couriers.length === 0), 'no courier serves the bad pincode');
  assert.ok(/not serviceable/i.test(groups[0].error) && /not serviceable/i.test(groups[1].error), 'errors are reported per courier');
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
  await svc.track(order, user); assert.equal(order.status, 'dispatched');
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

  // cancel, then rebook with a fresh reference (Shipmozo rejects duplicate order ids)
  await svc.cancel(order, user);
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
  assert.equal(order.status, 'dispatched'); assert.deepEqual(r.result.ndr.actions, ['Re-Attempt', 'RTO']);
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
  await svc.cancel(order, user); assert.equal(order.shipping.status, 'cancelled'); assert.equal(order.shipping.attempts, 1);
  await svc.book(order, customer, { ...parcel, provider: 'ekart' }, user);
  assert.equal(order.shipping.providerOrderId, 'ORD-000001-B1');
  // seller details missing -> clear error, nothing booked
  const cfgEnv = require('../src/config/env');
  const gst = cfgEnv.ekart.sellerGstTin; cfgEnv.ekart.sellerGstTin = '';
  await assert.rejects(svc.book(newOrder(), customer, { ...parcel, provider: 'ekart' }, user), /EKART_SELLER_GST_TIN/);
  assert.match((await registry.get('ekart').status()).message, /EKART_SELLER_GST_TIN/);
  cfgEnv.ekart.sellerGstTin = gst;

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
  assert.deepEqual(groups.map((g) => g.provider), ['xpressbees', 'ekart'], 'unconfigured courier is skipped in compare');

  console.log('ALL SHIPPING TESTS PASSED');
  server.close();
});
