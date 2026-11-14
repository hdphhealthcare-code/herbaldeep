const client = require('./xpressbeesClient');

const enc = encodeURIComponent;

/** One function per endpoint in the Xpressbees Custom API Postman collection. */
module.exports = {
  // Generate Token (POST /users/login) is handled inside xpressbeesClient
  ping: () => client.getToken(true),

  courierList: () => client.get('/courier'),                                  // GET  /courier
  serviceability: (payload) => client.post('/courier/serviceability', payload), // POST /courier/serviceability (price calculator)

  book: (payload) => client.post('/shipments2', payload),                     // POST /shipments2 (order booking -> AWB)
  reverseBook: (payload) => client.post('/reverseshipments', payload),        // POST /reverseshipments
  track: (awb) => client.get(`/shipments2/track/${enc(awb)}`),                // GET  /shipments2/track/{awb}
  manifest: (awbs) => client.post('/shipments2/manifest', { awbs }),          // POST /shipments2/manifest (pickup sheet)
  cancel: (awb) => client.post('/shipments2/cancel', { awb }),                // POST /shipments2/cancel

  ndrList: () => client.get('/ndr'),                                          // GET  /ndr
  ndrCreate: (actions) => client.post('/ndr/create', actions),                // POST /ndr/create (max 100 AWBs)
};
