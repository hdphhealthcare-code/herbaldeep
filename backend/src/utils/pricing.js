const ApiError = require('./ApiError');
const { GST_RATE } = require('../config/constants');

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Order pricing. The product price ALREADY INCLUDES GST (a Rs 650 product costs the customer Rs 650).
 * GST is only worked out of the price so it can be shown, it is never added on top:
 *   line:  price x qty  -  flat discount  =  payable (this is the line total)
 *          taxable = payable / (1 + rate%)      GST included = payable - taxable
 * lines: [{ price, quantity, discount? }]
 */
exports.priceLines = (lines, rate = GST_RATE) => {
  let subtotal = 0; let discountTotal = 0; let gstAmount = 0; let taxableAmount = 0; let total = 0;
  const priced = lines.map((l) => {
    const gross = round2(l.price * l.quantity);
    const discount = round2(l.discount || 0);
    if (!Number.isFinite(discount) || discount < 0) throw new ApiError(400, 'Discount must be a positive amount');
    if (discount > gross) throw new ApiError(400, `Discount (Rs ${discount}) cannot be more than the item amount (Rs ${gross})`);
    const payable = round2(gross - discount);
    const taxable = round2(payable / (1 + rate / 100));
    const gst = round2(payable - taxable);
    subtotal += gross; discountTotal += discount; gstAmount += gst; taxableAmount += taxable; total += payable;
    return { ...l, discount, gstAmount: gst, lineTotal: payable };
  });
  return {
    lines: priced,
    subtotal: round2(subtotal),            // before discount, GST included
    discountTotal: round2(discountTotal),
    gstRate: rate,
    gstAmount: round2(gstAmount),          // the GST contained in the total
    taxableAmount: round2(taxableAmount),  // total without GST
    totalAmount: round2(total),            // payable amount
    taxInclusive: true,
  };
};

exports.round2 = round2;
