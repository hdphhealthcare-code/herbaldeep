const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// GET /attendance?date=YYYY-MM-DD  -> every active employee with that day's status
exports.byDate = asyncHandler(async (req, res) => {
  const date = req.query.date;
  if (!date) throw new ApiError(400, 'date is required');
  const [employees, records] = await Promise.all([
    Employee.find({ isActive: true }).sort('name'),
    Attendance.find({ date }),
  ]);
  const map = new Map(records.map((r) => [String(r.employee), r]));
  res.json(employees.map((e) => ({
    employee: e,
    status: map.get(String(e._id))?.status || null,
    remarks: map.get(String(e._id))?.remarks || '',
  })));
});

// POST /attendance/mark  { date, records: [{ employee, status, remarks }] }
exports.mark = asyncHandler(async (req, res) => {
  const { date, records = [] } = req.body;
  if (!date || !records.length) throw new ApiError(400, 'date and records are required');
  await Attendance.bulkWrite(records.map((r) => ({
    updateOne: {
      filter: { employee: r.employee, date },
      update: { $set: { status: r.status, remarks: r.remarks, markedBy: req.user._id } },
      upsert: true,
    },
  })));
  res.json({ message: 'Attendance saved' });
});

// GET /attendance/monthly?month=YYYY-MM[&employee=id]  -> per-employee summary + daily map
exports.monthly = asyncHandler(async (req, res) => {
  const { month, employee } = req.query;
  if (!month) throw new ApiError(400, 'month is required');
  const filter = { date: { $regex: `^${month}` } };
  if (employee) filter.employee = employee;
  const records = await Attendance.find(filter).populate('employee', 'name employeeId');

  const summary = {};
  records.forEach((r) => {
    const key = String(r.employee._id);
    summary[key] ||= { employee: r.employee, present: 0, absent: 0, leave: 0, half_day: 0, days: {} };
    summary[key][r.status] += 1;
    summary[key].days[r.date] = r.status;
  });
  res.json(Object.values(summary));
});
