const router = require('express').Router();
const c = require('../controllers/productController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin'));
router.get('/low-stock', c.lowStock);
router.get('/movements', c.movements);
router.get('/', c.base.list);
router.get('/:id', c.base.getOne);
router.post('/', c.create);
router.put('/:id', c.update);
router.post('/:id/adjust-stock', c.adjustStock);
router.delete('/:id', c.base.remove);

module.exports = router;
