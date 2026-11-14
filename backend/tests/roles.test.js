/**
 * Roles + the confirmation step, without a database:
 *  - an agent's order belongs to that agent, and only to them (scope)
 *  - confirm: new -> confirmed, once; needs a valid customer address
 *  - agents cannot edit after confirmation; admin can
 *  - only a confirmed order can be shipped
 *  - route permissions: agents never ship, NDR team cannot create/ship, only agent+admin create/confirm
 *  - bulk helper reports each order on its own
 */
const assert = require('assert');

const inventory = require('../src/services/inventoryService');
inventory.changeStock = async () => {};
const Counter = require('../src/models/Counter');
const counterCalls = [];
Counter.nextCode = async (...args) => { counterCalls.push(args); return 'HBD-00042'; };
const User = require('../src/models/User');
const agentA = { _id: '64b000000000000000000a01', role: 'agent', name: 'Agent A' };
const agentB = { _id: '64b000000000000000000a02', role: 'agent', name: 'Agent B' };
User.findOne = async ({ _id }) => ({ '64b000000000000000000a01': agentA, '64b000000000000000000a02': agentB }[_id] || null);
const Product = require('../src/models/Product');
Product.findById = async () => ({ _id: 'p1', name: 'Thermometer', sku: 'T1', price: 100, isActive: true });
const Customer = require('../src/models/Customer');
let customerOwner = '64b000000000000000000a01';
const createdCustomers = [];
Customer.create = async (c) => { createdCustomers.push(c); return { _id: '64b000000000000000000c01', ...c }; };
Customer.findById = async () => ({ _id: '64b000000000000000000c09', pincode: '110001', address: '12 MG Road', state: 'Delhi', createdBy: customerOwner });
const Order = require('../src/models/Order');

const orderService = require('../src/services/orderService');
const shippingSvc = require('../src/services/orderShippingService');
const { scopeFor } = require('../src/utils/orderScope');
const { authorize } = require('../src/middleware/auth');
const { nextStatus } = require('../src/services/shipping/statusMap');

const admin = { _id: '64b000000000000000000ad1', role: 'admin', name: 'Admin' };
const goodCustomer = { name: 'Ravi', mobile: '9876543210', address: '12 MG Road', pincode: '110001', city: 'Delhi', state: 'Delhi' };
const allowed = (role, ...roles) => { let ok = false; authorize(...roles)({ user: { role } }, {}, (err) => { ok = !err; }); return ok; };

(async () => {
  // ---------- scope: Agent A never sees Agent B's orders ----------
  assert.deepEqual(scopeFor(agentA), { agent: '64b000000000000000000a01' });
  assert.deepEqual(scopeFor(agentB), { agent: '64b000000000000000000a02' });
  assert.deepEqual(scopeFor(admin), {});
  assert.deepEqual(scopeFor({ role: 'ndr' }), {}, 'the NDR team sees every order');

  // ---------- an agent creates an order: it is theirs, even if the request names somebody else ----------
  const saved = [];
  Order.prototype.save = async function save() { saved.push(this); return this; };
  const o = await orderService.createOrder({ customer: goodCustomer, items: [{ product: 'p1', quantity: 2 }], agentId: '64b000000000000000000a02' }, agentA);
  assert.equal(String(o.agent), '64b000000000000000000a01', 'agent cannot create an order for another agent');
  assert.equal(String(o.createdBy), '64b000000000000000000a01');
  assert.equal(o.status, 'agent_assigned');
  const byAdmin = await orderService.createOrder({ customer: goodCustomer, items: [{ product: 'p1', quantity: 1 }], agentId: '64b000000000000000000a02' }, admin);
  assert.equal(String(byAdmin.agent), '64b000000000000000000a02', 'an admin may assign the order to an agent');

  // ---------- confirmation ----------
  await orderService.confirmOrder(o, agentA);
  assert.equal(o.status, 'confirmed');
  assert.equal(String(o.confirmedBy), '64b000000000000000000a01'); assert.ok(o.confirmedAt);
  assert.equal(o.statusHistory.at(-1).status, 'confirmed');
  await assert.rejects(orderService.confirmOrder(o, agentA), /already confirmed/);
  await assert.rejects(orderService.confirmOrder({ status: 'in_transit', customer: goodCustomer }, admin), /Only a new order/);
  await assert.rejects(orderService.confirmOrder({ status: 'new_order', customer: { pincode: '12', address: 'a', state: 's' } }, admin), /pincode/);
  await assert.rejects(orderService.confirmOrder({ status: 'new_order', customer: { pincode: '110001', address: '', state: 's' } }, admin), /address or state/);

  // ---------- edit rules ----------
  await assert.rejects(orderService.updateOrder(o, { items: [{ product: 'p1', quantity: 1 }], customer: goodCustomer }, agentA), /only an admin/);

  // ---------- only a confirmed order can be shipped ----------
  await assert.rejects(shippingSvc.book({ status: 'new_order', shipping: {}, items: [] }, goodCustomer, {}, admin), /not confirmed yet/);
  await assert.rejects(shippingSvc.book({ status: 'agent_assigned', shipping: {}, items: [] }, goodCustomer, {}, admin), /not confirmed yet/);
  await assert.rejects(shippingSvc.book({ status: 'delivered', shipping: {}, items: [] }, goodCustomer, {}, admin), /Only a confirmed order/);

  // courier "pickup pending" scan moves a confirmed order to ready_for_dispatch
  assert.equal(nextStatus('confirmed', 'ready_for_dispatch'), 'ready_for_dispatch');

  // ---------- route permissions ----------
  // creating / confirming orders
  assert.ok(allowed('agent', 'admin', 'agent') && allowed('admin', 'admin', 'agent') && allowed('super_admin', 'admin', 'agent'));
  assert.ok(!allowed('ndr', 'admin', 'agent'), 'NDR team cannot create orders');
  assert.ok(!allowed('hr', 'admin', 'agent'));
  // shipping = admin only
  assert.ok(!allowed('agent', 'admin'), 'agents can never ship');
  assert.ok(!allowed('ndr', 'admin'), 'the NDR team cannot ship');
  assert.ok(allowed('admin', 'admin'));
  // serviceability: agent + ndr + admin
  assert.ok(allowed('agent', 'admin', 'agent', 'ndr') && allowed('ndr', 'admin', 'agent', 'ndr'));
  assert.ok(!allowed('hr', 'admin', 'agent', 'ndr'));
  // NDR actions: ndr + admin + agents (an agent's queries are scoped to their own orders), not HR
  assert.ok(allowed('ndr', 'admin', 'ndr', 'agent') && allowed('agent', 'admin', 'ndr', 'agent') && !allowed('hr', 'admin', 'ndr', 'agent'));

  // the real shipping router: every booking route is admin-only
  const shippingRouter = require('../src/routes/shippingRoutes');
  const guards = (path, method) => {
    const layer = shippingRouter.stack.find((l) => l.route && l.route.path === path && l.route.methods[method]);
    return layer ? layer.route.stack.length : 0;
  };
  assert.ok(guards('/orders/:id/book', 'post') === 1, 'book route exists');
  // router.use(authorize('admin')) sits before /orders/:id/book and after the NDR/serviceability routes
  const idx = (path, method) => shippingRouter.stack.findIndex((l) => l.route && l.route.path === path && l.route.methods[method]);
  const adminGate = shippingRouter.stack.findIndex((l, i) => !l.route && i > 1 && l.name !== 'bound dispatch' && l.handle.length === 3 && i > idx('/sync', 'post'));
  assert.ok(adminGate > idx('/sync', 'post'), 'an admin-only gate sits after the shared routes');
  assert.ok(idx('/orders/:id/book', 'post') > adminGate, 'booking is behind the admin gate');
  assert.ok(idx('/orders/:id/manifest', 'post') > adminGate && idx('/orders/:id/cancel', 'post') > adminGate && idx('/rate-calculator', 'post') > adminGate);
  assert.ok(idx('/serviceability', 'post') < adminGate && idx('/ndr', 'post') < adminGate);

  // ---------- bulk: one bad order does not block the rest ----------
  const out = await orderService.runBulk(
    [{ _id: '1', orderId: 'A' }, { _id: '2', orderId: 'B' }, { _id: '3', orderId: 'C' }],
    async (x) => { if (x.orderId === 'B') throw new Error('nope'); }
  );
  assert.deepEqual(out.map((r) => r.ok), [true, false, true]);
  assert.equal(out[1].message, 'nope');

  // ---------- products: agents may read the list, never change it ----------
  const productRouter = require('../src/routes/productRoutes');
  const pIdx = (path, method) => productRouter.stack.findIndex((l) => l.route && l.route.path === path && l.route.methods[method]);
  const pGate = productRouter.stack.findIndex((l, i) => !l.route && i > 0);
  assert.ok(pIdx('/', 'get') < pGate && pIdx('/', 'post') > pGate, 'listing is open to agents, creating is behind the admin gate');
  let sent;
  const prodController = require('../src/controllers/productController');
  const req = { user: { role: 'agent' }, query: {} };
  prodController.listForRole(req, { json: () => {} }, () => {}).catch?.(() => {});
  assert.equal(req.query.isActive, 'true', 'an agent only gets active products');

  // ---------- v3.4: HBD numbering, GST number, customers belong to the agent who added them ----------
  assert.deepEqual(counterCalls[0], ['order_hbd', 'HBD', 5], 'orders are numbered HBD-00001, HBD-00002 ...');
  assert.equal(o.orderId, 'HBD-00042');
  assert.equal(o.taxInclusive, true); assert.equal(o.totalAmount, 200, 'price 100 x 2 stays 200: GST is not added');
  assert.equal(o.gstAmount, 9.52, '5% GST contained in 200');
  const withGst = await orderService.createOrder({ customer: goodCustomer, items: [{ product: 'p1', quantity: 1 }], gstNumber: ' 24abcde1234f1z5 ' }, agentA);
  assert.equal(withGst.gstNumber, '24ABCDE1234F1Z5', 'GST number is cleaned and stored, agents can add it too');
  await assert.rejects(orderService.createOrder({ customer: goodCustomer, items: [{ product: 'p1', quantity: 1 }], gstNumber: '123' }, agentA), /valid 15-character GSTIN/);
  const noGst = await orderService.createOrder({ customer: goodCustomer, items: [{ product: 'p1', quantity: 1 }] }, agentA);
  assert.equal(noGst.gstNumber, undefined, 'the GST number is optional');
  // a customer an agent types in is saved under that agent, whatever the request says
  createdCustomers.length = 0;
  await orderService.createOrder({ customer: { ...goodCustomer, createdBy: '64b000000000000000000a02' }, items: [{ product: 'p1', quantity: 1 }] }, agentA);
  assert.equal(String(createdCustomers[0].createdBy), '64b000000000000000000a01');
  // an agent can pick their own existing customer but not somebody else's
  await orderService.createOrder({ customerId: 'x', items: [{ product: 'p1', quantity: 1 }] }, agentA);
  customerOwner = '64b000000000000000000a02';
  await assert.rejects(orderService.createOrder({ customerId: 'x', items: [{ product: 'p1', quantity: 1 }] }, agentA), /added by someone else/);
  await orderService.createOrder({ customerId: 'x', items: [{ product: 'p1', quantity: 1 }] }, admin); // an admin sees every customer
  // the customers router: agents may list / add / edit, only the admin deletes
  const customerRouter = require('../src/routes').stack.find((l) => l.regexp.test('/customers/'))?.handle;
  const cRoute = (path, method) => customerRouter.stack.find((l) => l.route && l.route.path === path && l.route.methods[method]);
  const gate = (route, role) => { let ok = false; route.route.stack[0].handle({ user: { role } }, {}, (err) => { ok = !err; }); return ok; };
  assert.ok(gate(cRoute('/', 'get'), 'agent') && gate(cRoute('/', 'post'), 'agent') && gate(cRoute('/:id', 'put'), 'agent'));
  assert.ok(!gate(cRoute('/:id', 'delete'), 'agent') && gate(cRoute('/:id', 'delete'), 'admin'), 'agents cannot delete customers');
  assert.ok(!gate(cRoute('/', 'get'), 'ndr') && !gate(cRoute('/', 'get'), 'hr'));

  console.log('roles tests passed');
})().catch((e) => { console.error(e); process.exit(1); });
