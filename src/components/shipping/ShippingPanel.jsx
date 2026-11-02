'use client';

import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { SHIPPING_STATUS, PROVIDER_LABEL } from '@/lib/shipping';
import BookShipmentForm from './BookShipmentForm';
import ShipmentActions from './ShipmentActions';

const Fact = ({ label, value }) => (value ? (
  <div><dt className="text-xs text-muted">{label}</dt><dd className="text-sm font-medium">{value}</dd></div>
) : null);

// Workflow: compare rates + book -> label / manifest / track / cancel / return pickup
export default function ShippingPanel({ order, onUpdated }) {
  const s = order.shipping || { status: 'not_pushed' };
  const meta = SHIPPING_STATUS[s.status] || SHIPPING_STATUS.not_pushed;
  const booked = s.status === 'booked';
  const provider = PROVIDER_LABEL[s.provider || 'xpressbees'];

  if (order.status === 'cancelled') return null;

  return (
    <Card title={booked ? `Shipping (${provider})` : 'Shipping'} action={<Badge tone={meta.tone}>{meta.label}</Badge>}>
      {booked && (
        <dl className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Fact label="Platform" value={provider} />
          <Fact label="Courier" value={s.courierName} />
          <Fact label="AWB number" value={s.awb || 'Pending. Press Track shipment'} />
          <Fact label="Latest status" value={s.lastTrackStatus} />
          <Fact label="Payment" value={s.paymentType} />
          <Fact label="Weight" value={s.weight ? `${s.weight} g` : ''} />
          <Fact label="LR number" value={s.lrNumber} />
          <Fact label="Return AWB" value={s.returnAwb} />
        </dl>
      )}
      {booked ? <ShipmentActions order={order} onUpdated={onUpdated} /> : <BookShipmentForm order={order} onUpdated={onUpdated} />}
    </Card>
  );
}
