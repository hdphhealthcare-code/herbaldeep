const router = require('express').Router();
const c = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
// Admin may list agents (for assignment); only super admin manages users.
router.get('/', authorize('admin'), c.list);
router.get('/:id', authorize('admin'), c.getOne);
router.post('/', authorize(), c.create);
router.put('/:id', authorize(), c.update);
router.delete('/:id', authorize(), c.remove);

module.exports = router;
