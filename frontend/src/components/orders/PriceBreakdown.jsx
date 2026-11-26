import { currency } from '@/lib/format';
import { GST_RATE } from '@/lib/constants';

/**
 * Price summary. inclusive (every order from v3.4 on): the prices already contain GST, so
 *   Subtotal - Discount = Total, and "Includes GST 5%" only shows how much of the total is GST.
 * Older orders (inclusive = false) added the GST on top of the taxable amount and are shown that way.
 * Works for a live preview (priceLines result) and for a saved order.
 */
export default function PriceBreakdown({ subtotal, discountTotal = 0, gstAmount, totalAmount, taxableAmount, rate = GST_RATE, inclusive = true, compact = false }) {
  const Row = ({ label, value, minus, strong, soft }) => (
    <div className={`flex items-center justify-between ${strong ? 'border-t border-border pt-3' : ''}`}>
      <dt className={strong ? 'font-semibold' : soft ? 'text-xs text-muted' : 'text-muted'}>{label}</dt>
      <dd className={`num ${strong ? 'text-lg font-semibold' : soft ? 'text-xs text-muted' : 'font-medium'}`}>{minus ? '- ' : ''}{currency(value)}</dd>
    </div>
  );
  if (inclusive) {
    const without = taxableAmount ?? totalAmount - gstAmount;
    return (
      <dl className={`space-y-2.5 ${compact ? 'text-xs' : 'text-sm'}`}>
        <Row label="Subtotal" value={subtotal} />
        {discountTotal > 0 && <Row label="Discount (flat)" value={discountTotal} minus />}
        <Row label="Total" value={totalAmount} strong />
        <div className="rounded-lg bg-success-soft px-3 py-2 text-success">
          <div className="flex items-center justify-between"><span className="font-medium">Includes GST {rate}%</span><span className="num font-semibold">{currency(gstAmount)}</span></div>
          <div className="mt-0.5 flex items-center justify-between text-xs opacity-80"><span>Amount without GST</span><span className="num">{currency(without)}</span></div>
        </div>
      </dl>
    );
  }
  const taxable = subtotal - discountTotal;
  return (
    <dl className={`space-y-2.5 ${compact ? 'text-xs' : 'text-sm'}`}>
      <Row label="Subtotal" value={subtotal} />
      {discountTotal > 0 && <Row label="Discount (flat)" value={discountTotal} minus />}
      {discountTotal > 0 && <Row label="Taxable amount" value={taxable} />}
      <Row label={`GST ${rate}%`} value={gstAmount} />
      <Row label="Total (with GST)" value={totalAmount} strong />
    </dl>
  );
}
