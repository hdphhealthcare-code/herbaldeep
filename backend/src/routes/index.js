const router = require('express').Router();
const crud = require('../controllers/crudFactory');
const resourceRoutes = require('./resourceRoutes');
const Zone = require('../models/Zone');
const Customer = require('../models/Customer');
const Employee = require('../models/Employee');

router.use('/auth', require('./authRoutes'));
router.use('/users', require('./userRoutes'));
router.use('/products', require('./productRoutes'));
router.use('/orders', require('./orderRoutes'));
router.use('/invoices', require('./invoiceRoutes'));
router.use('/attendance', require('./attendanceRoutes'));
router.use('/shipping', require('./shippingRoutes'));
router.use('/dashboard', require('./dashboardRoutes'));

router.use('/zones', resourceRoutes(
  crud(Zone, { searchFields: ['name'], filterFields: ['isActive'], sanitize: (b) => ({
    ...b, areas: Array.isArray(b.areas) ? b.areas : String(b.areas || '').split(',').map((s) => s.trim()).filter(Boolean),
  }) }),
  ['admin']
));
router.use('/customers', resourceRoutes(
  crud(Customer, { searchFields: ['name', 'mobile', 'city'], filterFields: ['city'] }),
  ['admin']
));
router.use('/employees', resourceRoutes(
  crud(Employee, { searchFields: ['name', 'employeeId', 'mobile', 'department'], filterFields: ['isActive', 'department'] }),
  ['hr']
));

module.exports = router;
