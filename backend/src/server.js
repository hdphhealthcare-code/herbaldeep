const app = require('./app');
const connectDB = require('./config/db');
const env = require('./config/env');
const { port } = env;
const poller = require('./services/trackingPoller');
const { ensureAdmin } = require('./services/bootstrapAdmin');

connectDB()
  .then(() => ensureAdmin())
  .then(() => app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
    // Which courier servers are used. Every one must be the courier's real server (the test mock lives only in backend/tests)
    ['xpressbees', 'shipmozo', 'ekart', 'delhivery', 'shiprocket'].forEach((id) => {
      const c = env[id] || {};
      const live = Object.entries(c).some(([k, v]) => /key|token|email|username|password|clientId/i.test(k) && v);
      if (!live) return console.log(`  ${id.padEnd(10)} not configured`);
      const local = /localhost|127\.0\.0\.1/.test(c.baseUrl || '');
      console.log(`  ${id.padEnd(10)} ${local ? 'WARNING: points to a LOCAL test server -> ' : ''}${c.baseUrl}`);
    });
    poller.start(); // live courier status for every booked shipment
  }))
  .catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
