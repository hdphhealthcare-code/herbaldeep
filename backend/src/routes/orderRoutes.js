const router = require('express').Router();
const c = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', authorize('admin', 'agent'), c.list);
router.get('/:id', authorize('admin', 'agent'), c.getOne);
router.post('/', authorize('admin'), c.create);
router.put('/:id/assign-agent', authorize('admin'), c.assignAgent);
router.put('/:id/zone', authorize('admin'), c.updateZone);
router.put('/:id/courier', authorize('admin'), c.updateCourier);
router.put('/:id/status', authorize('admin', 'agent'), c.updateStatus);

module.exports = router;
