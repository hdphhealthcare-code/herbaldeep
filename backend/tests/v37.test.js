const assert = require('assert');
const { snapshotOf, withSnapshot } = require('../src/utils/customerSnapshot');
const { receivedExpr, COMPLETED } = require('../src/utils/revenue');

// A shipped order keeps the customer details it was shipped with
const order = { orderId: 'HBD-00001', customer: { _id: 'c1', name: 'New Name', city: 'Pune', pincode: '411001' }, customerSnapshot: { name: 'Rati Ram', city: 'Mumbai', pincode: '400055', address: 'Atari Khejda' } };
const shown = withSnapshot(order);
assert.equal(shown.customer.name, 'Rati Ram', 'the snapshot wins over the edited customer record');
assert.equal(shown.customer.address, 'Atari Khejda');
assert.equal(shown.customer._id, 'c1', 'the customer id stays');
assert.equal(shown.customerSnapshot, undefined, 'the snapshot itself is not sent to the browser');
assert.equal(withSnapshot({ customer: { name: 'A' } }).customer.name, 'A', 'an order without a snapshot shows the live customer');
assert.deepEqual(snapshotOf({ name: 'A', mobile: '9876543210', foo: 'x', city: '' }), { name: 'A', mobile: '9876543210' }, 'only shipment fields are copied, empty ones skipped');

// Revenue = money of completed orders
assert.deepEqual(COMPLETED, ['delivered', 'invoice_generated']);
assert.ok(receivedExpr.$cond, 'COD orders count the collected COD amount, prepaid orders their total');
console.log('v3.7 tests passed');
