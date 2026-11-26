const router = require('express').Router();
const crud = require('../controllers/crudFactory');
const resourceRoutes = require('./resourceRoutes');
const Customer = require('../models/Customer');
const Employee = require('../models/Employee');
const { protect, authorize } = require('../middleware/auth');

router.use('/auth', require('./authRoutes'));
router.use('/users', require('./userRoutes'));
router.use('/products', require('./productRoutes'));
router.use('/orders', require('./orderRoutes'));
router.use('/invoices', require('./invoiceRoutes'));
router.use('/attendance', require('./attendanceRoutes'));
router.use('/shipping', require('./shippingRoutes'));
router.use('/dashboard', require('./dashboardRoutes'));
router.use('/pincode', require('./pincodeRoutes'));
router.use('/webhooks', require('./webhookRoutes'));

// Customers: the admin manages all of them; an agent adds customers and sees / edits only the ones they added
const customerHandlers = crud(Customer, {
  searchFields: ['name', 'mobile', 'city', 'pincode'],
  filterFields: ['city', 'state', 'pincode'],
  populate: { path: 'createdBy', select: 'name' },
  scope: (req) => (req.user.role === 'agent' ? { createdBy: req.user._id } : {}),
  // the owner is always the logged-in user, never something the request says
  sanitize: (body, req) => {
    const { createdBy, _id, ...fields } = body || {};
    return req.method === 'POST' ? { ...fields, createdBy: req.user._id } : fields;
  },
});
const customerRouter = require('express').Router();
customerRouter.use(protect);
customerRouter.get('/', authorize('admin', 'agent'), customerHandlers.list);
customerRouter.get('/:id', authorize('admin', 'agent'), customerHandlers.getOne);
customerRouter.post('/', authorize('admin', 'agent'), customerHandlers.create);
customerRouter.put('/:id', authorize('admin', 'agent'), customerHandlers.update);
customerRouter.delete('/:id', authorize('admin'), customerHandlers.remove);
router.use('/customers', customerRouter);
router.use('/employees', resourceRoutes(
  crud(Employee, { searchFields: ['name', 'employeeId', 'mobile', 'department'], filterFields: ['isActive', 'department'] }),
  ['hr']
));

module.exports = router;
