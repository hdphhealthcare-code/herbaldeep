const app = require('./app');
const connectDB = require('./config/db');
const { port } = require('./config/env');
const poller = require('./services/trackingPoller');
const { ensureAdmin } = require('./services/bootstrapAdmin');

connectDB()
  .then(() => ensureAdmin())
  .then(() => app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
    poller.start(); // live courier status for every booked shipment
  }))
  .catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
