/**
 * Order flow without a database: courier status mapping, live tracking rules, agent assign/change lock,
 * order cancel, pincode lookup, webhook, background poller. Models are stubbed where they would touch MongoDB.
 */
const assert = require('assert');

process.env.WEBHOOK_SECRET = 'hook-secret';

// ---- stubs (before the services that import them) ----
const inventory = require('../src/services/inventoryService');
const stock = [];
inventory.changeStock = async (x) => { stock.push(x); };
const Invoice = require('../src/models/Invoice');
let hasInvoice = false;
Invoice.exists = async () => (hasInvoice ? { _id: 'inv' } : null);
const User = require('../src/models/User');
const agents = { a1: { _id: 'a1', name: 'Agent One' }, a2: { _id: 'a2', name: 'Agent Two' }, a3: { _id: 'a3', name: 'Agent Three' } };
User.findOne = async ({ _id }) => agents[_id] || null;
User.findById = (id) => ({ select: async () => agents[id] || null });

const { mapCourierStatus, nextStatus } = require('../src/services/shipping/statusMap');
const tracking = require('../src/services/trackingService');
const orderService = require('../src/services/orderService');
const pincode = require('../src/services/pincodeService');

const mkOrder = (over = {}) => ({
  _id: 'o1', orderId: 'ORD-000001', status: 'ready_for_dispatch', items: [{ product: 'p1', quantity: 2 }],
  statusHistory: [], courier: {}, agentChanges: 0,
  shipping: { status: 'booked', provider: 'xpressbees', awb: '111' },
  save: async function save() { return this; },
  ...over,
});

(async () => {
  // ---------- courier wording -> CRM status ----------
  const cases = {
    'Pickup Pending': 'ready_for_dispatch', 'pending pickup': 'ready_for_dispatch', 'Out For Pickup': 'ready_for_dispatch',
    'Pickup Scheduled': 'ready_for_dispatch', 'Shipment Created': 'ready_for_dispatch', 'Manifested': 'ready_for_dispatch',
    'Picked Up': 'in_transit', 'In Transit': 'in_transit', 'Shipment In Transit': 'in_transit', 'Reached at Destination Hub': 'in_transit',
    'Out For Delivery': 'out_for_delivery', 'OFD': 'out_for_delivery',
    'Undelivered': 'ndr', 'NDR': 'ndr', 'Delivery Attempted': 'ndr', 'Customer Not Available': 'ndr',
    'Delivered': 'delivered', 'DELIVERED': 'delivered',
    'RTO Initiated': 'rto', 'RTO_IN_TRANSIT': 'rto', 'RTO Delivered': 'rto_delivered', 'Returned to Origin': 'rto_delivered',
    'Cancelled': 'cancelled', 'Lost': null, '': null, undefined: null,
  };
  Object.entries(cases).forEach(([text, want]) => assert.strictEqual(mapCourierStatus(text === 'undefined' ? undefined : text), want, `"${text}"`));

  // ---------- transition rules ----------
  assert.equal(nextStatus('ready_for_dispatch', 'in_transit'), 'in_transit');
  assert.equal(nextStatus('in_transit', 'ready_for_dispatch'), 'in_transit', 'a late pickup scan never pulls an order back');
  assert.equal(nextStatus('agent_assigned', 'ready_for_dispatch'), 'ready_for_dispatch');
  assert.equal(nextStatus('ndr', 'out_for_delivery'), 'out_for_delivery', 're-attempt after NDR moves forward');
  assert.equal(nextStatus('delivered', 'in_transit'), 'delivered', 'finished orders stay finished');
  assert.equal(nextStatus('cancelled', 'delivered'), 'cancelled');
  assert.equal(nextStatus('rto', 'in_transit'), 'rto', 'returning parcel is not turned back into a forward one');
  assert.equal(nextStatus('rto', 'rto_delivered'), 'rto_delivered');
  assert.equal(nextStatus('in_transit', null), 'in_transit');

  // ---------- applyTracking: live status ----------
  let o = mkOrder();
  let r = await tracking.applyTracking(o, { status: 'Picked Up', history: [{ message: 'Picked Up', location: 'Gurgaon', time: 't1' }] }, { auto: true });
  assert.deepEqual([r.changed, o.status], [true, 'in_transit']);
  assert.equal(o.shipping.lastTrackStatus, 'Picked Up');
  assert.equal(o.shipping.trackHistory.length, 1);
  assert.equal(o.statusHistory.at(-1).auto, true, 'history marks live updates as automatic');
  assert.ok(o.courier.dispatchDate, 'dispatch date is filled when the parcel moves');
  r = await tracking.applyTracking(o, { status: 'In Transit' }, { auto: true });
  assert.equal(r.changed, false, 'same status again writes no new history');
  const historyLen = o.statusHistory.length;
  await tracking.applyTracking(o, { status: 'In Transit' }, { auto: true });
  assert.equal(o.statusHistory.length, historyLen);
  await tracking.applyTracking(o, { status: 'Out For Delivery' }, { auto: true }); assert.equal(o.status, 'out_for_delivery');
  await tracking.applyTracking(o, { status: 'Undelivered', ndr: { status: 'open', actions: ['Re-Attempt'] } }, { auto: true });
  assert.equal(o.status, 'ndr'); assert.deepEqual(o.shipping.ndr.actions, ['Re-Attempt']);
  await tracking.applyTracking(o, { status: 'Delivered' }, { auto: true });
  assert.equal(o.status, 'delivered'); assert.equal(o.courier.deliveryStatus, 'delivered');
  await tracking.applyTracking(o, { status: 'In Transit' }, { auto: true }); assert.equal(o.status, 'delivered');

  hasInvoice = true;
  o = mkOrder({ status: 'out_for_delivery' });
  await tracking.applyTracking(o, { status: 'Delivered' }, { auto: true });
  assert.equal(o.status, 'invoice_generated', 'delivered after an invoice exists goes straight to invoice generated');
  hasInvoice = false;

  o = mkOrder({ status: 'in_transit' });
  await tracking.applyTracking(o, { status: 'RTO Initiated' }, { auto: true }); assert.equal(o.status, 'rto');
  await tracking.applyTracking(o, { status: 'RTO Delivered' }, { auto: true }); assert.equal(o.status, 'rto_delivered');

  // courier cancels the booking before pickup -> order is free to be shipped again
  o = mkOrder({ agent: 'a1' });
  r = await tracking.applyTracking(o, { status: 'Cancelled' }, { auto: true });
  assert.equal(o.status, 'confirmed'); assert.equal(o.shipping.status, 'cancelled'); assert.equal(o.shipping.awb, undefined);
  assert.equal(o.shipping.attempts, 1);

  // ---------- agent: assign once, change once, then locked ----------
  o = mkOrder({ status: 'new_order', agent: undefined, shipping: { status: 'not_pushed' } });
  const admin = { _id: 'adm' };
  await orderService.assignAgent(o, 'a1', admin);
  assert.equal(o.agent, 'a1'); assert.equal(o.status, 'agent_assigned'); assert.equal(o.agentChanges, 0, 'first assignment is not a change');
  await assert.rejects(orderService.assignAgent(o, 'a1', admin), /already assigned/);
  await orderService.assignAgent(o, 'a2', admin);
  assert.equal(o.agent, 'a2'); assert.equal(o.agentChanges, 1);
  assert.match(o.statusHistory.at(-1).note, /changed from Agent One to Agent Two/);
  await assert.rejects(orderService.assignAgent(o, 'a3', admin), /locked/);
  assert.equal(o.agent, 'a2', 'locked agent stays');
  await assert.rejects(orderService.assignAgent(mkOrder({ status: 'new_order', agent: undefined }), 'nope', admin), /not available/);
  await assert.rejects(orderService.assignAgent(mkOrder({ status: 'delivered' }), 'a1', admin), /finished order/);

  // ---------- cancel order ----------
  o = mkOrder({ status: 'new_order', shipping: { status: 'not_pushed' } });
  await orderService.cancelOrder(o, 'customer asked', admin);
  assert.equal(o.status, 'cancelled'); assert.equal(stock.length, 1); assert.equal(stock[0].change, 2, 'reserved stock returns to inventory');
  await assert.rejects(orderService.cancelOrder(o, '', admin), /already cancelled/);
  await assert.rejects(orderService.cancelOrder(mkOrder({ status: 'in_transit' }), '', admin), /already picked/);
  await assert.rejects(orderService.cancelOrder(mkOrder({ status: 'ready_for_dispatch', shipping: { status: 'booked', provider: 'xpressbees' } }), '', admin), /AWB is still pending/);

  // ---------- pricing: the product price INCLUDES 5% GST; GST is shown, never added on top ----------
  const { priceLines } = require('../src/utils/pricing');
  let pr = priceLines([{ price: 1000, quantity: 2, discount: 200 }, { price: 250, quantity: 1 }]);
  assert.equal(pr.subtotal, 2250); assert.equal(pr.discountTotal, 200);
  assert.equal(pr.totalAmount, 2050, 'subtotal - discount: nothing is added for GST');
  assert.equal(pr.gstAmount, 97.61, 'the GST contained in 2050 (85.71 + 11.90)');
  assert.equal(pr.taxableAmount, 1952.39); assert.equal(pr.taxInclusive, true);
  assert.equal(pr.lines[0].lineTotal, 1800, '2000 - 200');
  const p650 = priceLines([{ price: 650, quantity: 1 }]);
  assert.deepEqual([p650.totalAmount, p650.gstAmount, p650.taxableAmount], [650, 30.95, 619.05], 'a Rs 650 product with 5% GST stays Rs 650');
  assert.throws(() => priceLines([{ price: 100, quantity: 1, discount: 150 }]), /cannot be more/);
  assert.throws(() => priceLines([{ price: 100, quantity: 1, discount: -5 }]), /positive/);
  assert.equal(priceLines([{ price: 99.99, quantity: 3 }]).totalAmount, 299.97);

  // ---------- courier options: mode, rating, recommended ----------
  const { enrichCouriers, tagGroups, ratingOf } = require('../src/services/shipping/rateMeta');
  assert.equal(ratingOf(4.26), 4.3); assert.equal(ratingOf(86), 4.3, 'percentage becomes stars'); assert.equal(ratingOf(0), undefined); assert.equal(ratingOf('x'), undefined);
  const groups = tagGroups([
    { provider: 'xpressbees', couriers: enrichCouriers([{ id: '1', name: 'Surface Xpressbees 0.5 K.G', rate: 67 }, { id: '2', name: 'Air Xpressbees 0.5 K.G', rate: 67 }, { id: '3', name: 'Xpressbees 1 K.G', rate: 94 }]) },
    { provider: 'shipmozo', couriers: enrichCouriers([{ id: '9', name: 'Delhivery', rate: 72, rating: 4.6, eta: '2-3 days' }, { id: '8', name: 'Bluedart Express', rate: 120, rating: 4.9, eta: '1 day' }]) },
  ]);
  const flat = groups.flatMap((g) => g.couriers);
  assert.deepEqual(flat.map((c) => c.mode), ['surface', 'air', 'surface', 'surface', 'air']);
  assert.ok(flat.find((c) => c.id === '9').tags.includes('recommended'), 'good rating at a fair price wins');
  assert.ok(flat.find((c) => c.id === '1').tags.includes('cheapest'));
  assert.ok(flat.find((c) => c.id === '8').tags.includes('fastest'));
  const noRating = tagGroups([{ provider: 'a', couriers: enrichCouriers([{ id: 'x', name: 'A', rate: 90 }, { id: 'y', name: 'B', rate: 60 }]) }]);
  assert.ok(noRating[0].couriers[1].tags.includes('recommended'), 'without ratings, recommended = cheapest');

  // ---------- edit guards: only unshipped orders can be edited ----------
  await assert.rejects(orderService.updateOrder(mkOrder({ status: 'new_order', shipping: { status: 'booked' } }), { items: [{ product: 'p', quantity: 1 }] }, admin), /already shipped/);
  await assert.rejects(orderService.updateOrder(mkOrder({ status: 'in_transit', shipping: { status: 'not_pushed' } }), { items: [{ product: 'p', quantity: 1 }] }, admin), /not shipped yet can be edited/);
  await assert.rejects(orderService.updateOrder(mkOrder({ status: 'new_order', shipping: { status: 'not_pushed' } }), { items: [] }, admin), /at least one product/);

  // ---------- create order validation (fails before touching the database) ----------
  await assert.rejects(orderService.createOrder({ items: [] }, admin), /at least one product/);
  await assert.rejects(orderService.createOrder({ items: [{ product: 'p', quantity: 1 }], customer: { name: 'A', mobile: '9999999999', address: 'x', city: 'Delhi' } }, admin), /pincode, state/);
  await assert.rejects(orderService.createOrder({ items: [{ product: 'p', quantity: 1 }], customer: { name: 'A', mobile: '9999999999', address: 'x', city: 'Delhi', state: 'Delhi', pincode: '1100' } }, admin), /6 digits/);

  // ---------- pincode lookup ----------
  const realFetch = global.fetch;
  const hits = [];
  global.fetch = async (url) => {
    hits.push(url);
    if (String(url).endsWith('/110001')) {
      return { ok: true, json: async () => [{ Status: 'Success', PostOffice: [
        { Name: 'Connaught Place', District: 'New Delhi', State: 'Delhi', Block: 'NA' }, { Name: 'Baroda House', District: 'New Delhi', State: 'Delhi' }] }] };
    }
    if (String(url).endsWith('/999999')) return { ok: true, json: async () => [{ Status: 'Error', Message: 'No records found', PostOffice: null }] };
    throw new Error('network down');
  };
  await assert.rejects(pincode.lookup('1234'), /6-digit/);
  await assert.rejects(pincode.lookup('012345'), /6-digit/);
  let p = await pincode.lookup('110001');
  assert.deepEqual([p.state, p.city, p.source, p.approximate], ['Delhi', 'New Delhi', 'india-post', false]);
  assert.deepEqual(p.localities, ['Connaught Place', 'Baroda House']);
  const before = hits.length; await pincode.lookup('110001'); assert.equal(hits.length, before, 'second lookup comes from cache');
  await assert.rejects(pincode.lookup('999999'), /not found/);
  p = await pincode.lookup('400001'); // network down -> state from prefix
  assert.deepEqual([p.state, p.city, p.approximate, p.source], ['Maharashtra', '', true, 'prefix']);
  assert.equal(pincode.stateFromPrefix('403001'), 'Goa'); assert.equal(pincode.stateFromPrefix('248001'), 'Uttarakhand'); assert.equal(pincode.stateFromPrefix('201301'), 'Uttar Pradesh');
  assert.equal(pincode.stateFromPrefix('737101'), 'Sikkim'); assert.equal(pincode.stateFromPrefix('900000'), null);
  await assert.rejects(pincode.lookup('900000'), /Could not look up/);
  global.fetch = realFetch;

  // ---------- webhook ----------
  const Order = require('../src/models/Order');
  const webhook = require('../src/controllers/webhookController');
  const call = (req) => new Promise((resolve) => {
    const res = { json: (b) => resolve({ code: 200, body: b }) };
    webhook.receive(req, res, (err) => resolve({ code: err.statusCode || err.status, message: err.message }));
  });
  assert.equal((await call({ query: {}, headers: {}, body: {} })).code, 401);
  assert.equal((await call({ query: { token: 'wrong' }, headers: {}, body: {} })).code, 401);
  assert.equal((await call({ query: { token: 'hook-secret' }, headers: {}, body: { foo: 1 } })).body.matched, false);
  const wh = mkOrder({ status: 'ready_for_dispatch' });
  Order.findOne = async (q) => (q['shipping.awb'] === '111' ? wh : null);
  let out = await call({ query: {}, headers: { 'x-webhook-secret': 'hook-secret' }, body: { data: { awb_number: '111', status: 'In Transit', location: 'Delhi' } } });
  assert.deepEqual([out.body.matched, out.body.changed, out.body.status, wh.status], [true, true, 'in_transit', 'in_transit']);
  assert.equal(wh.shipping.trackHistory[0].location, 'Delhi');
  out = await call({ query: { token: 'hook-secret' }, headers: {}, body: { awb: '404', status: 'Delivered' } });
  assert.equal(out.body.matched, false, 'unknown AWB is acknowledged, not an error');

  // Delhivery pushes its own nested format, with its own status words ("Dispatched" = out for delivery)
  wh.status = 'in_transit';
  out = await call({ params: { provider: 'delhivery' }, query: { token: 'hook-secret' }, headers: {}, body: { Shipment: { AWB: '111', Status: { Status: 'Dispatched', StatusType: 'UD', StatusLocation: 'Noida', Instructions: 'Out for delivery' } } } });
  assert.deepEqual([out.body.matched, out.body.status, wh.status], [true, 'out_for_delivery', 'out_for_delivery']);
  assert.equal(wh.shipping.trackHistory[0].location, 'Noida');

  // ---------- background poller ----------
  const registry = require('../src/services/shipping');
  const shippingSvc = require('../src/services/orderShippingService');
  const poller = require('../src/services/trackingPoller');
  registry.configured = () => [{ id: 'xpressbees' }];
  const queue = [mkOrder({ orderId: 'A', status: 'ready_for_dispatch' }), mkOrder({ orderId: 'B', status: 'in_transit' }), mkOrder({ orderId: 'C', shipping: { status: 'booked', provider: 'shipmozo', awb: '9' } })];
  Order.find = () => ({ sort: () => ({ limit: async () => queue }) });
  const seen = [];
  shippingSvc.track = async (order, user, opts) => {
    seen.push([order.orderId, user, opts.auto]);
    if (order.orderId === 'B') throw new Error('courier down');
    order.status = 'in_transit';
    return { order };
  };
  const stats = await poller.runOnce({ force: true });
  assert.deepEqual(seen.map((s) => s[0]), ['A', 'B'], 'orders of an unconfigured courier are skipped');
  assert.deepEqual(stats, { checked: 2, updated: 1, failed: 1 }, 'one failing shipment does not stop the others');
  assert.ok(seen.every((s) => s[1] === null && s[2] === true), 'runs as the system, not as a user');

  console.log('ALL ORDER FLOW TESTS PASSED');
})().catch((err) => { console.error(err); process.exit(1); });
