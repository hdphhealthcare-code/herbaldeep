const router = require('express').Router();
const c = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/login', c.login);
router.get('/me', protect, c.me);
router.put('/change-password', protect, c.changePassword);

module.exports = router;
