import { GST_RATE } from '@/lib/constants';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Same maths as the server (backend/src/utils/pricing.js), used for the live preview while creating an order.
 * The product price INCLUDES 5% GST: a Rs 650 product costs Rs 650. GST is only worked out of it to be shown.
 *   price x qty - flat discount = payable (the line total);  GST included = payable - payable / 1.05
 */
export function priceLines(lines, rate = GST_RATE) {
  let subtotal = 0; let discountTotal = 0; let gstAmount = 0; let taxableAmount = 0; let totalAmount = 0;
  const priced = lines.map((l) => {
    const gross = round2((Number(l.price) || 0) * (Number(l.quantity) || 0));
    const discount = Math.min(Math.max(round2(l.discount || 0), 0), gross);
    const lineTotal = round2(gross - discount);
    const taxable = round2(lineTotal / (1 + rate / 100));
    const gst = round2(lineTotal - taxable);
    subtotal += gross; discountTotal += discount; gstAmount += gst; taxableAmount += taxable; totalAmount += lineTotal;
    return { gross, discount, taxable, gst, lineTotal, tooMuch: round2(l.discount || 0) > gross };
  });
  return {
    lines: priced, subtotal: round2(subtotal), discountTotal: round2(discountTotal), gstAmount: round2(gstAmount),
    taxableAmount: round2(taxableAmount), totalAmount: round2(totalAmount), rate,
  };
}
