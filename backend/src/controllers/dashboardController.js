const Order = require('../models/Order');
const Invoice = require('../models/Invoice');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');

const today = () => new Date().toISOString().slice(0, 10);

const orderStats = async (scope = {}) => {
  const rows = await Order.aggregate([{ $match: scope }, { $group: { _id: '$status', count: { $sum: 1 } } }]);
  const by = Object.fromEntries(rows.map((r) => [r._id, r.count]));
  const n = (k) => by[k] || 0;
  const total = rows.reduce((s, r) => s + r.count, 0);
  const completed = n('delivered') + n('invoice_generated');
  const rto = n('rto') + n('rto_delivered');
  return {
    total,
    new: n('new_order'),
    assigned: n('agent_assigned'),
    toConfirm: n('new_order') + n('agent_assigned'), // created, waiting for confirmation
    confirmed: n('confirmed'), // confirmed, waiting for an admin to ship
    ready: n('ready_for_dispatch'),
    inTransit: n('in_transit') + n('out_for_delivery'),
    ndr: n('ndr'),
    completed,
    rto,
    cancelled: n('cancelled'),
    pending: total - completed - rto - n('cancelled'), // everything still open
    byStatus: by,
  };
};

exports.get = asyncHandler(async (req, res) => {
  const { user } = req;

  if (user.role === 'agent') {
    return res.json({ orders: await orderStats({ agent: user._id }) });
  }
  if (user.role === 'ndr') {
    return res.json({ orders: await orderStats() });
  }

  const result = {};
  if (['super_admin', 'admin'].includes(user.role)) {
    const [orders, invoices, agentWise, lowStock, inventory, revenue] = await Promise.all([
      orderStats(),
      Invoice.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { agent: { $ne: null } } },
        { $group: { _id: '$agent', count: { $sum: 1 } } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'agent' } },
        { $project: { count: 1, name: { $arrayElemAt: ['$agent.name', 0] } } },
      ]),
      Product.countDocuments({ isActive: true, $expr: { $lte: ['$stock', '$reorderLevel'] } }),
      Product.aggregate([{ $group: { _id: null, products: { $sum: 1 }, units: { $sum: '$stock' } } }]),
      Invoice.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$grandTotal' } } }]),
    ]);
    const inv = Object.fromEntries(invoices.map((r) => [r._id, r.count]));
    result.orders = orders;
    result.invoices = {
      total: invoices.reduce((s, r) => s + r.count, 0),
      pending: (inv.pending || 0) + (inv.generated || 0),
      paid: inv.paid || 0,
      revenue: revenue[0]?.total || 0,
    };
    result.agentWise = agentWise;
    result.inventory = { lowStock, products: inventory[0]?.products || 0, units: inventory[0]?.units || 0 };
  }

  if (['super_admin', 'hr'].includes(user.role)) {
    const [totalEmployees, att] = await Promise.all([
      Employee.countDocuments({ isActive: true }),
      Attendance.aggregate([{ $match: { date: today() } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);
    const a = Object.fromEntries(att.map((r) => [r._id, r.count]));
    result.hr = { total: totalEmployees, present: a.present || 0, absent: a.absent || 0, leave: a.leave || 0, halfDay: a.half_day || 0 };
  }
  res.json(result);
});
