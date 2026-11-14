const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { parseListQuery, paginated } = require('../utils/pagination');
const { createInvoice, calculate } = require('../services/invoiceService');

const POPULATE = [{ path: 'customer' }, { path: 'order', select: 'orderId' }];

exports.list = asyncHandler(async (req, res) => {
  const { filter, page, limit, sort } = parseListQuery(req.query, { filterFields: ['status', 'order', 'customer'] });
  if (req.query.search) {
    const rx = new RegExp(req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const customers = await Customer.find({ $or: [{ name: rx }, { mobile: rx }] }).select('_id');
    filter.$or = [{ invoiceNo: rx }, { customer: { $in: customers.map((c) => c._id) } }];
  }
  const [data, total] = await Promise.all([
    Invoice.find(filter).populate(POPULATE).sort(sort).skip((page - 1) * limit).limit(limit),
    Invoice.countDocuments(filter),
  ]);
  res.json(paginated(data, total, page, limit));
});

exports.getOne = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id).populate(POPULATE);
  if (!invoice) throw new ApiError(404, 'Invoice not found');
  res.json(invoice);
});

exports.create = asyncHandler(async (req, res) => {
  const invoice = await createInvoice(req.body, req.user);
  res.status(201).json(await invoice.populate(POPULATE));
});

exports.update = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) throw new ApiError(404, 'Invoice not found');
  const { lines = invoice.lines, discount = invoice.discount, taxPercent = invoice.taxPercent, ...rest } = req.body;
  invoice.set({ ...rest, discount, taxPercent, ...calculate(lines, discount, taxPercent) });
  await invoice.save();
  res.json(await invoice.populate(POPULATE));
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
  if (!invoice) throw new ApiError(404, 'Invoice not found');
  res.json(invoice);
});
