import { currency } from '@/lib/format';

// inclusive = the rates already contain the GST (orders from v3.4 on): the GST is worked out of the total, not added on top
export function computeTotals(lines, discount, taxPercent, inclusive = false) {
  const subtotal = lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.rate || 0), 0);
  const payable = Math.max(subtotal - Number(discount || 0), 0);
  const rate = Number(taxPercent || 0) / 100;
  if (inclusive) return { subtotal, tax: payable - payable / (1 + rate), grandTotal: payable };
  return { subtotal, tax: payable * rate, grandTotal: payable + payable * rate };
}

export default function InvoiceTotals({ subtotal, discount, taxPercent, tax, grandTotal, inclusive = false }) {
  const Row = ({ label, value, strong }) => (
    <div className={`flex justify-between ${strong ? 'border-t border-border pt-2 text-base font-semibold' : 'text-sm'}`}>
      <span className={strong ? '' : 'text-muted'}>{label}</span><span>{value}</span>
    </div>
  );
  return (
    <div className="ml-auto w-full max-w-xs space-y-2">
      <Row label="Subtotal" value={currency(subtotal)} />
      {Number(discount) > 0 && <Row label="Discount" value={`- ${currency(discount)}`} />}
      {Number(taxPercent) > 0 && <Row label={inclusive ? `Includes GST (${taxPercent}%)` : `Tax / GST (${taxPercent}%)`} value={currency(tax)} />}
      <Row label="Grand total" value={currency(grandTotal)} strong />
    </div>
  );
}
