const client = require('./shipmozoClient');

const enc = encodeURIComponent;

module.exports = {
  // ---- Utility ----
  info: () => client.get('/info'),                                           // GET  /info
  login: (username, password) =>                                             // POST /login (no keys needed)
    client.post('/login', { username, password }, { auth: false }),

  // ---- Orders ----
  pushOrder: (payload) => client.post('/push-order', payload),               // POST /push-order
  pushReturnOrder: (payload) => client.post('/push-return-order', payload),  // POST /push-return-order
  assignCourier: (orderId, courierId) =>                                     // POST /assign-courier
    client.post('/assign-courier', { order_id: orderId, courier_id: courierId }),
  autoAssignOrder: (orderId) => client.post('/auto-assign-order', { order_id: orderId }), // POST /auto-assign-order
  schedulePickup: (orderId) => client.post('/schedule-pickup', { order_id: orderId }),    // POST /schedule-pickup
  cancelOrder: (orderId, awb) =>                                             // POST /cancel-order
    client.post('/cancel-order', { order_id: orderId, awb_number: Number(awb) || awb }),
  getOrderDetail: (orderId) => client.get(`/get-order-detail/${enc(orderId)}`), // GET /get-order-detail/{order_id}

  // ---- Rates & serviceability ----
  rateCalculator: (payload) => client.post('/rate-calculator', payload),     // POST /rate-calculator
  pincodeServiceability: (pickup, delivery) =>                               // POST /pincode-serviceability
    client.post('/pincode-serviceability', { pickup_pincode: Number(pickup), delivery_pincode: Number(delivery) }),
  getReturnReasons: () => client.get('/get-return-reason'),                  // GET  /get-return-reason

  // ---- Labels & tracking ----
  getOrderLabel: (awb) => client.get(`/get-order-label/${enc(awb)}`),        // GET  /get-order-label/{awb}
  trackOrder: (awb) => client.get('/track-order', { awb_number: awb }),      // GET  /track-order?awb_number=

  // ---- Warehouses ----
  createWarehouse: (payload) => client.post('/create-warehouse', payload),   // POST /create-warehouse
  getWarehouses: () => client.get('/get-warehouses'),                        // GET  /get-warehouses
  updateWarehouse: (orderId, warehouseId) =>                                 // POST /order/update-warehouse
    client.post('/order/update-warehouse', { order_id: orderId, warehouse_id: warehouseId }),
};
