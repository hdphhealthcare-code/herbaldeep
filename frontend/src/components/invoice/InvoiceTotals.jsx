import { currency } from '@/lib/format';

export function computeTotals(lines, discount, taxPercent) {
  const subtotal = lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.rate || 0), 0);
  const taxable = Math.max(subtotal - Number(discount || 0), 0);
  const tax = taxable * (Number(taxPercent || 0) / 100);
  return { subtotal, tax, grandTotal: taxable + tax };
}

export default function InvoiceTotals({ subtotal, discount, taxPercent, tax, grandTotal }) {
  const Row = ({ label, value, strong }) => (
    <div className={`flex justify-between ${strong ? 'border-t border-border pt-2 text-base font-semibold' : 'text-sm'}`}>
      <span className={strong ? '' : 'text-muted'}>{label}</span><span>{value}</span>
    </div>
  );
  return (
    <div className="ml-auto w-full max-w-xs space-y-2">
      <Row label="Subtotal" value={currency(subtotal)} />
      {Number(discount) > 0 && <Row label="Discount" value={`- ${currency(discount)}`} />}
      {Number(taxPercent) > 0 && <Row label={`Tax / GST (${taxPercent}%)`} value={currency(tax)} />}
      <Row label="Grand total" value={currency(grandTotal)} strong />
    </div>
  );
}
