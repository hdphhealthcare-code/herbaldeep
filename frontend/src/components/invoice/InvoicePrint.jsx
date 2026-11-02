import { formatDate, currency } from '@/lib/format';
import StatusBadge from '@/components/common/StatusBadge';
import InvoiceTotals from './InvoiceTotals';

// Printable invoice sheet. `.print-area` is the only thing visible when printing.
export default function InvoicePrint({ invoice }) {
  const c = invoice.customer || {};
  return (
    <div className="print-area rounded-xl border border-border bg-surface p-8 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div>
          <h2 className="text-xl font-semibold text-primary">Fusse Market Pvt. Ltd.</h2>
          <p className="mt-1 text-xs text-muted">+91 8418818469 · contact@fusemarket.in · fusemarket.in</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">Invoice {invoice.invoiceNo}</p>
          <p className="text-sm text-muted">Date: {formatDate(invoice.invoiceDate)}</p>
          {invoice.order?.orderId && <p className="text-sm text-muted">Order: {invoice.order.orderId}</p>}
          <div className="mt-1"><StatusBadge type="invoice" value={invoice.status} /></div>
        </div>
      </div>

      <div className="py-6 text-sm">
        <p className="text-xs text-muted">Billed to</p>
        <p className="font-medium">{c.name}</p>
        <p>{c.mobile}</p>
        <p className="text-muted">{[c.address, c.area, c.city, c.pincode].filter(Boolean).join(', ')}</p>
      </div>

      <table className="w-full text-sm">
        <thead className="bg-surface-muted text-xs text-muted">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Description</th>
            <th className="px-3 py-2 text-right font-medium">Qty</th>
            <th className="px-3 py-2 text-right font-medium">Rate</th>
            <th className="px-3 py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {invoice.lines.map((l, i) => (
            <tr key={i}>
              <td className="px-3 py-2.5">{l.name}</td>
              <td className="px-3 py-2.5 text-right">{l.quantity}</td>
              <td className="px-3 py-2.5 text-right">{currency(l.rate)}</td>
              <td className="px-3 py-2.5 text-right">{currency(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6">
        <InvoiceTotals subtotal={invoice.subtotal} discount={invoice.discount} taxPercent={invoice.taxPercent} tax={invoice.taxAmount} grandTotal={invoice.grandTotal} />
      </div>
      {invoice.remarks && <p className="mt-6 text-sm text-muted">Remarks: {invoice.remarks}</p>}
    </div>
  );
}
