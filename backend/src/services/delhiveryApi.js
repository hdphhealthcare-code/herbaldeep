const client = require('./delhiveryClient');

/** One function per Delhivery endpoint we use. */
module.exports = {
  pincode: (pin) => client.get('/c/api/pin-codes/json/', { filter_codes: pin }),                    // GET  serviceability of one pincode
  charges: (q) => client.get('/api/kinko/v1/invoice/charges/.json', q),                            // GET  shipping cost (md=S|E, pt=Pre-paid|COD ...)
  tat: (q) => client.get('/api/dc/expected_tat', q),                                               // GET  expected delivery days
  createWarehouse: (body) => client.postJson('/api/backend/clientwarehouse/create/', body),         // POST register a pickup location
  createOrder: (data) => client.postForm('/api/cmu/create.json', { format: 'json', data: JSON.stringify(data) }), // POST create + manifest shipment
  track: (awb) => client.get('/api/v1/packages/json/', { waybill: awb, verbose: 2 }),               // GET  tracking
  packingSlip: (awb) => client.get('/api/p/packing_slip', { wbns: awb, pdf: 'true' }, { binary: true }), // GET label
  cancel: (awb) => client.postJson('/api/p/edit', { waybill: awb, cancellation: 'true' }),          // POST cancel (before pickup)
  pickupRequest: (body) => client.postJson('/fm/request/new/', body),                                // POST pickup request
  ndr: (body) => client.postJson('/api/p/update', body),                                             // POST NDR action (re-attempt / defer)
};
