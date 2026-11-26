// A shipped order keeps the customer details it was shipped with. Editing the customer afterwards (Customers page,
// another order's edit form) must not change the label, the address or the courier booking of an order already on its way.
const FIELDS = ['name', 'mobile', 'altMobile', 'email', 'address', 'area', 'city', 'state', 'pincode'];

// Copy of the customer fields that matter for a shipment
exports.snapshotOf = (customer) => {
  const c = customer?.toObject ? customer.toObject() : customer || {};
  return Object.fromEntries(FIELDS.filter((k) => c[k] !== undefined && c[k] !== null && c[k] !== '').map((k) => [k, c[k]]));
};

/**
 * Plain object of the order where `customer` shows the details at the time of shipping (when there is a snapshot).
 * Works for lean rows and for mongoose documents; the snapshot field itself is not sent to the browser.
 */
exports.withSnapshot = (order) => {
  const plain = order?.toJSON ? order.toJSON() : { ...order };
  const snap = plain.customerSnapshot;
  delete plain.customerSnapshot;
  if (snap && plain.customer && typeof plain.customer === 'object') plain.customer = { ...plain.customer, ...snap };
  return plain;
};

exports.SNAPSHOT_FIELDS = FIELDS;
