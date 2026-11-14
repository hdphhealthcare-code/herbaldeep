const router = require('express').Router();
const c = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('hr'));
router.get('/', c.byDate);
router.get('/monthly', c.monthly);
router.post('/mark', c.mark);

module.exports = router;
