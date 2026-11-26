const client = require('./shiprocketClient');

const enc = encodeURIComponent;

/** One function per Shiprocket endpoint we use (API v1 external). */
module.exports = {
  ping: () => client.getToken(true),                                                          // POST /auth/login
  serviceability: (q) => client.get('/courier/serviceability/', q, { soft: true }),           // GET  couriers + rates for a route
  pickupLocations: () => client.get('/settings/company/pickup'),                              // GET  registered pickup addresses
  addPickup: (body) => client.post('/settings/company/addpickup', body),                      // POST register a pickup address
  createOrder: (body) => client.post('/orders/create/adhoc', body),                           // POST create the order (gives shipment_id)
  assignAwb: (body) => client.post('/courier/assign/awb', body),                              // POST choose courier -> AWB
  generatePickup: (shipmentIds) => client.post('/courier/generate/pickup', { shipment_id: shipmentIds }),
  manifest: (shipmentIds) => client.post('/manifests/generate', { shipment_id: shipmentIds }), // POST pickup manifest PDF
  label: (shipmentIds) => client.post('/courier/generate/label', { shipment_id: shipmentIds }), // POST label PDF url
  track: (awb) => client.get(`/courier/track/awb/${enc(awb)}`, undefined, { soft: true }),    // GET  tracking
  cancelAwbs: (awbs) => client.post('/orders/cancel/shipment/awbs', { awbs }),                // POST cancel shipment(s)
  cancelOrders: (ids) => client.post('/orders/cancel', { ids }),                              // POST cancel the order(s)
  ndr: (awb, body) => client.post(`/ndr/${enc(awb)}/action`, body),                           // POST NDR action
};
