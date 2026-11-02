const Invoice = require('../models/Invoice');
const Order = require('../models/Order');
const Counter = require('../models/Counter');
const ApiError = require('../utils/ApiError');

exports.calculate = (lines, discount = 0, taxPercent = 0) => {
  const calcLines = lines.map((l) => ({ ...l, amount: Number(l.quantity) * Number(l.rate) }));
  const subtotal = calcLines.reduce((s, l) => s + l.amount, 0);
  const taxable = Math.max(subtotal - Number(discount || 0), 0);
  const taxAmount = +(taxable * (Number(taxPercent || 0) / 100)).toFixed(2);
  return { lines: calcLines, subtotal, taxAmount, grandTotal: +(taxable + taxAmount).toFixed(2) };
};

exports.createInvoice = async (body, user) => {
  let { customer, lines } = body;
  let order = null;

  if (body.order) {
    order = await Order.findById(body.order);
    if (!order) throw new ApiError(404, 'Order not found');
    customer = customer || order.customer;
    if (!lines || !lines.length) {
      lines = order.items.map((i) => ({ name: i.name, quantity: i.quantity, rate: i.price }));
    }
  }
  if (!customer) throw new ApiError(400, 'Customer is required');
  if (!lines || !lines.length) throw new ApiError(400, 'Add at least one line item');

  const totals = exports.calculate(lines, body.discount, body.taxPercent);
  const invoice = await Invoice.create({
    invoiceNo: await Counter.nextCode('invoice', 'INV'),
    customer,
    order: order?._id,
    discount: body.discount || 0,
    taxPercent: body.taxPercent || 0,
    status: body.status || 'generated',
    remarks: body.remarks,
    invoiceDate: body.invoiceDate || Date.now(),
    createdBy: user._id,
    ...totals,
  });

  // Workflow: delivered -> invoice generated
  if (order && order.status === 'delivered') {
    order.status = 'invoice_generated';
    order.statusHistory.push({ status: 'invoice_generated', note: invoice.invoiceNo, by: user._id });
    await order.save();
  }
  return invoice;
};
