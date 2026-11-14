const router = require('express').Router();
const c = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');

/**
 * Who can do what with orders
 *   view (own only for agents)   admin, agent, ndr
 *   create / edit / confirm      admin, agent   (an agent: own orders only, edit until confirmed)
 *   ship (courier booking)       admin only     -> see shippingRoutes
 *   assign agent / cancel        admin only
 * Bulk routes come first so "bulk" is never read as an order id.
 */
router.use(protect);
router.get('/', authorize('admin', 'agent', 'ndr'), c.list);
router.get('/counts', authorize('admin', 'agent', 'ndr'), c.counts);

router.post('/bulk/confirm', authorize('admin', 'agent'), c.bulkConfirm);
router.post('/bulk/cancel', authorize('admin'), c.bulkCancel);
router.post('/bulk/assign-agent', authorize('admin'), c.bulkAssign);
router.post('/bulk/import', authorize('admin', 'agent'), c.bulkImport);

router.get('/:id', authorize('admin', 'agent', 'ndr'), c.getOne);
router.post('/', authorize('admin', 'agent'), c.create);
router.put('/:id', authorize('admin', 'agent'), c.update);
router.post('/:id/confirm', authorize('admin', 'agent'), c.confirm);
router.put('/:id/assign-agent', authorize('admin'), c.assignAgent);
router.post('/:id/cancel', authorize('admin'), c.cancel);

module.exports = router;
