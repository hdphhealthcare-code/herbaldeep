require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Zone = require('../models/Zone');
const Product = require('../models/Product');
const Employee = require('../models/Employee');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const email = process.env.SEED_ADMIN_EMAIL || 'admin@fusemarket.in';
  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';

  if (!(await User.findOne({ email }))) {
    await User.create({ name: 'Super Admin', email, password, role: 'super_admin' });
    console.log(`Super admin created: ${email} / ${password}`);
  }

  const north = await Zone.findOneAndUpdate({ name: 'North Zone' }, { areas: ['delhi', 'noida', 'gurugram'] }, { upsert: true, new: true });
  await Zone.findOneAndUpdate({ name: 'West Zone' }, { areas: ['mumbai', 'pune'] }, { upsert: true });

  const demo = [
    { name: 'Admin User', email: 'ops@fusemarket.in', role: 'admin' },
    { name: 'HR User', email: 'hr@fusemarket.in', role: 'hr' },
    { name: 'Agent One', email: 'agent@fusemarket.in', role: 'agent', zone: north._id },
  ];
  for (const u of demo) {
    if (!(await User.findOne({ email: u.email }))) await User.create({ ...u, password });
  }

  if (!(await Product.countDocuments())) {
    await Product.insertMany([
      { name: 'Digital Thermometer', sku: 'THERM-01', price: 250, stock: 100, reorderLevel: 20 },
      { name: 'BP Monitor', sku: 'BPM-01', price: 1800, stock: 40, reorderLevel: 10 },
      { name: 'Glucometer Strips (50)', sku: 'GLU-50', price: 650, stock: 8, reorderLevel: 15 },
    ]);
  }
  if (!(await Employee.countDocuments())) {
    await Employee.create({ employeeId: 'EMP-001', name: 'Rahul Sharma', mobile: '9999999999', designation: 'Executive', department: 'Operations', joiningDate: new Date() });
  }
  console.log('Seed complete (demo users share the same password as super admin)');
  process.exit(0);
})();
