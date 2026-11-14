const router = require('express').Router();
const c = require('../controllers/shippingController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

/**
 * Who can do what with shipping
 *   Agents and the NDR team (read only / own purpose):
 *     - pincode serviceability, the pickup warehouse list
 *   NDR team + admin + agents (an agent only reaches their own orders):
 *     - NDR list, NDR actions (re-attempt / RTO) for every courier, live status refresh of a shipment
 *   Admin only (everything that books or changes a shipment):
 *     - rates, book (ship), manifest, label, cancel shipment, return, warehouses, courier status
 * Agents can never ship: every booking route below sits behind authorize('admin').
 */
router.post('/serviceability', authorize('admin', 'agent', 'ndr'), c.serviceability);
router.get('/warehouses', authorize('admin', 'agent', 'ndr'), c.warehouses);

// NDR: the NDR team and admin see every order; an agent works only on their own (the controller scopes every query)
router.get('/ndr', authorize('admin', 'ndr', 'agent'), c.ndrList);
router.post('/orders/bulk-ndr', authorize('admin', 'ndr', 'agent'), c.bulkNdr);
router.post('/orders/:id/ndr', authorize('admin', 'ndr', 'agent'), c.orderNdr);
router.get('/orders/:id/track', authorize('admin', 'ndr', 'agent'), c.track);
router.post('/sync', authorize('admin', 'ndr'), c.syncAll);

router.use(authorize('admin'));

router.get('/providers', c.providers);
router.get('/status', c.status);
router.get('/couriers', c.couriers);
router.get('/return-reasons', c.returnReasons);
router.post('/warehouses', c.createWarehouse);
router.put('/warehouses/:id', c.updateWarehouse);
router.delete('/warehouses/:id', c.deleteWarehouse);
router.post('/rate-calculator', c.rateCalculator);

router.post('/orders/:id/rates', c.rates);
router.post('/orders/:id/book', c.book);
router.get('/orders/:id/label', c.label);
router.post('/orders/:id/manifest', c.manifest);
router.post('/orders/:id/cancel', c.cancel);
router.post('/orders/:id/return', c.pushReturn);

module.exports = router;
