/** npm run create-admin  -> creates the super admin from .env (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD), or resets its password. */
require('dotenv').config();
const mongoose = require('mongoose');
const { resetAdmin } = require('../services/bootstrapAdmin');

(async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing in backend/.env');
  await mongoose.connect(process.env.MONGO_URI);
  const r = await resetAdmin();
  console.log(`Database: ${mongoose.connection.name}`);
  console.log(`${r.created ? 'Created' : 'Password reset for'} super admin\n  email:    ${r.email}\n  password: ${r.password}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
