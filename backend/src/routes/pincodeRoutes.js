const router = require('express').Router();
const c = require('../controllers/pincodeController');
const { protect } = require('../middleware/auth');

// Any logged-in user: it only returns public pincode data
router.get('/:pin', protect, c.lookup);

module.exports = router;
