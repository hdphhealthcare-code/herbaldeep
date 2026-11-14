const User = require('../models/User');

const creds = () => ({
  email: String(process.env.SEED_ADMIN_EMAIL || 'admin@herbaldeep.in').toLowerCase().trim(),
  password: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
});

/**
 * First start on an empty database: create the super admin so there is always a way to log in.
 * Does nothing once any user exists.
 */
exports.ensureAdmin = async () => {
  if (await User.estimatedDocumentCount()) return null;
  const { email, password } = creds();
  await User.create({ name: 'Super Admin', email, password, role: 'super_admin' });
  console.log(`[setup] Database was empty. Super admin created: ${email} / ${password}`);
  return email;
};

/** Create the super admin, or reset its password if it already exists. (npm run create-admin) */
exports.resetAdmin = async () => {
  const { email, password } = creds();
  let user = await User.findOne({ email });
  if (user) {
    user.password = password; user.isActive = true; user.role = user.role || 'super_admin';
    await user.save();
    return { email, password, created: false };
  }
  user = await User.create({ name: 'Super Admin', email, password, role: 'super_admin' });
  return { email: user.email, password, created: true };
};
