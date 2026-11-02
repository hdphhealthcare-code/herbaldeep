import { MapPin, Phone, User } from 'lucide-react';
import Card from '@/components/ui/Card';
import { currency } from '@/lib/format';

export default function OrderSummary({ order, canSeeCustomer = true }) {
  const c = order.customer;
  return (
    <>
      {canSeeCustomer && c && (
        <Card title="Customer">
          <ul className="space-y-2 text-sm">
            <li className="flex gap-2"><User className="h-4 w-4 text-muted" /> {c.name}</li>
            <li className="flex gap-2"><Phone className="h-4 w-4 text-muted" /> {c.mobile}</li>
            <li className="flex gap-2"><MapPin className="h-4 w-4 shrink-0 text-muted" />
              {[c.address, c.area, c.city, c.pincode].filter(Boolean).join(', ')}
            </li>
          </ul>
        </Card>
      )}
      <Card title="Products" padded={false}>
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-xs text-muted">
            <tr>
              <th className="px-5 py-2.5 text-left font-medium">Product</th>
              <th className="px-5 py-2.5 text-right font-medium">Qty</th>
              <th className="px-5 py-2.5 text-right font-medium">Price</th>
              <th className="px-5 py-2.5 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {order.items.map((it) => (
              <tr key={it.product}>
                <td className="px-5 py-3"><p className="font-medium">{it.name}</p><p className="text-xs text-muted">{it.sku}</p></td>
                <td className="px-5 py-3 text-right">{it.quantity}</td>
                <td className="px-5 py-3 text-right">{currency(it.price)}</td>
                <td className="px-5 py-3 text-right">{currency(it.price * it.quantity)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border">
              <td colSpan={3} className="px-5 py-3 text-right font-medium">Total</td>
              <td className="px-5 py-3 text-right text-base font-semibold">{currency(order.totalAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </Card>
      {order.notes && <Card title="Notes"><p className="text-sm text-muted">{order.notes}</p></Card>}
    </>
  );
}
