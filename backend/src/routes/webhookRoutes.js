const router = require('express').Router();
const c = require('../controllers/webhookController');

// Public (couriers cannot log in); protected by WEBHOOK_SECRET instead
router.post('/:provider', c.receive);

module.exports = router;
