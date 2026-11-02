const router = require('express').Router();
const c = require('../controllers/invoiceController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin'));
router.get('/', c.list);
router.get('/:id', c.getOne);
router.post('/', c.create);
router.put('/:id', c.update);
router.put('/:id/status', c.updateStatus);

module.exports = router;
