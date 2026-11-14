import { MapPin, Phone, User } from 'lucide-react';
import Card from '@/components/ui/Card';
import { currency } from '@/lib/format';
import PriceBreakdown from './PriceBreakdown';

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
              {[c.address, c.area, c.city, c.state, c.pincode].filter(Boolean).join(', ')}
            </li>
          </ul>
        </Card>
      )}
      <Card title="Products" padded={false}>
        <table className="w-full text-sm">
          <thead className="bg-surface-muted/60">
            <tr>
              <th className="eyebrow px-5 py-3 text-left">Product</th>
              <th className="eyebrow px-5 py-3 text-right">Qty</th>
              <th className="eyebrow px-5 py-3 text-right">Price</th>
              <th className="eyebrow px-5 py-3 text-right">Discount</th>
              <th className="eyebrow px-5 py-3 text-right">{order.taxInclusive ? 'Total' : 'With GST'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {order.items.map((it) => (
              <tr key={it.product}>
                <td className="px-5 py-3.5"><p className="font-medium">{it.name}</p><p className="num text-xs text-muted">{it.sku}</p></td>
                <td className="num px-5 py-3.5 text-right">{it.quantity}</td>
                <td className="num px-5 py-3.5 text-right">{currency(it.price)}</td>
                <td className="num px-5 py-3.5 text-right">{it.discount ? `- ${currency(it.discount)}` : '-'}</td>
                <td className="num px-5 py-3.5 text-right font-semibold">{currency(it.lineTotal || it.price * it.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ml-auto max-w-xs border-t border-border p-5">
          <PriceBreakdown
            subtotal={order.subtotal ?? order.totalAmount} discountTotal={order.discountTotal || 0}
            gstAmount={order.gstAmount || 0} totalAmount={order.totalAmount} taxableAmount={order.taxableAmount || undefined}
            rate={order.gstRate ?? 5} inclusive={Boolean(order.taxInclusive)}
          />
        </div>
      </Card>
      <Card title="Payment & package">
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div><dt className="text-xs text-muted">Payment</dt><dd className="font-medium">{order.payment?.type === 'COD' ? `COD (${currency(order.payment.codAmount || order.totalAmount)})` : 'Prepaid'}</dd></div>
          <div><dt className="text-xs text-muted">Weight</dt><dd className="font-medium">{order.parcel?.weight ? `${order.parcel.weight} g` : '-'}</dd></div>
          <div><dt className="text-xs text-muted">Size (L x W x H)</dt><dd className="font-medium">{order.parcel?.length ? `${order.parcel.length} x ${order.parcel.width} x ${order.parcel.height} cm` : '-'}</dd></div>
          <div><dt className="text-xs text-muted">Pickup warehouse</dt><dd className="font-medium">{order.warehouse?.title || '-'}</dd></div>
          {order.gstNumber && <div><dt className="text-xs text-muted">GST number</dt><dd className="num font-medium">{order.gstNumber}</dd></div>}
        </dl>
      </Card>
      {order.notes && <Card title="Notes"><p className="text-sm text-muted">{order.notes}</p></Card>}
    </>
  );
}
