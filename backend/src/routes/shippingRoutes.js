const router = require('express').Router();
const c = require('../controllers/shippingController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin'));

// Tools (not tied to one order). Provider-specific calls take ?provider= / body.provider
router.get('/providers', c.providers);                  // which couriers exist, which are configured, what they support
router.get('/status', c.status);                        // connection test for every courier
router.get('/couriers', c.couriers);                    // Courier List (?provider=xpressbees)
router.get('/return-reasons', c.returnReasons);         // Shipmozo return reasons
router.get('/warehouses', c.warehouses);                // pickup locations (stored in our DB)
router.post('/warehouses', c.createWarehouse);
router.delete('/warehouses/:id', c.deleteWarehouse);
router.post('/serviceability', c.serviceability);       // Courier Serviceability
router.post('/rate-calculator', c.rateCalculator);      // Price Calculator (ad-hoc)
router.get('/ndr', c.ndrList);                          // NDR / Exception List
router.post('/ndr', c.ndrAction);                       // Create NDR / Exception action

// Per order
router.post('/orders/:id/rates', c.rates);              // Price Calculator (for this order)
router.post('/orders/:id/book', c.book);                // Order Booking
router.get('/orders/:id/track', c.track);               // Track Shipment
router.get('/orders/:id/label', c.label);               // Label URL returned by booking
router.post('/orders/:id/manifest', c.manifest);        // Generate Manifest / Pickup
router.post('/orders/:id/cancel', c.cancel);            // Cancel Shipment
router.post('/orders/:id/return', c.pushReturn);        // Reverse Booking
router.post('/orders/:id/ndr', c.orderNdr);             // NDR action on this shipment (Ekart)

module.exports = router;
