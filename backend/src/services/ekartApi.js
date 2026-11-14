const client = require('./ekartClient');

const enc = encodeURIComponent;

/** One function per endpoint of the Ekart API (OpenAPI spec v3.8). */
module.exports = {
  ping: () => client.getToken(true),                                              // POST /integrations/v2/auth/token/{client_id}

  serviceability: (payload) => client.post('/data/v3/serviceability', payload),   // POST /data/v3/serviceability (couriers + charges)
  createShipment: (payload) => client.put('/api/v1/package/create', payload),     // PUT  /api/v1/package/create (forward + reverse)
  cancel: (trackingId) => client.del(`/api/v1/package/cancel?tracking_id=${enc(trackingId)}`), // DELETE /api/v1/package/cancel
  label: (ids) => client.post('/api/v1/package/label?json_only=false', { ids }, { binary: true }), // POST /api/v1/package/label (PDF)
  manifest: (ids) => client.post('/data/v2/generate/manifest', { ids }),          // POST /data/v2/generate/manifest
  track: (id) => client.get(`/api/v1/track/${enc(id)}`),                          // GET  /api/v1/track/{id}
  ndr: (payload) => client.post('/api/v2/package/ndr', payload),                  // POST /api/v2/package/ndr (Re-Attempt / RTO)

  addresses: () => client.get('/api/v2/addresses'),                               // GET  /api/v2/addresses (registered pickup locations)
  createAddress: (payload) => client.post('/api/v2/address', payload),            // POST /api/v2/address
};
