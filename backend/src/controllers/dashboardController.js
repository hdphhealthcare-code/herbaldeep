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
  const total = rows.reduce((s, r) => s + r.count, 0);
  const done = (by.delivered || 0) + (by.invoice_generated || 0);
  return {
    total,
    new: by.new_order || 0,
    pending: total - done - (by.cancelled || 0),
    assigned: by.agent_assigned || 0,
    dispatched: by.dispatched || 0,
    completed: done,
    cancelled: by.cancelled || 0,
    byStatus: by,
  };
};

exports.get = asyncHandler(async (req, res) => {
  const { user } = req;

  if (user.role === 'agent') {
    return res.json({ orders: await orderStats({ agent: user._id }) });
  }

  const result = {};
  if (['super_admin', 'admin'].includes(user.role)) {
    const [orders, invoices, zoneWise, agentWise, lowStock, inventory, revenue] = await Promise.all([
      orderStats(),
      Invoice.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Order.aggregate([
        { $group: { _id: '$zone', count: { $sum: 1 } } },
        { $lookup: { from: 'zones', localField: '_id', foreignField: '_id', as: 'zone' } },
        { $project: { count: 1, name: { $ifNull: [{ $arrayElemAt: ['$zone.name', 0] }, 'Unassigned'] } } },
      ]),
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
    result.zoneWise = zoneWise;
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
