'use client';

import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { SHIPPING_STATUS, PROVIDER_LABEL } from '@/lib/shipping';
import Link from 'next/link';
import { Truck } from 'lucide-react';
import Button from '@/components/ui/Button';
import ShipmentActions from './ShipmentActions';
import TrackingDetails from './TrackingDetails';

const Fact = ({ label, value }) => (value ? (
  <div><dt className="text-xs text-muted">{label}</dt><dd className="text-sm font-medium">{value}</dd></div>
) : null);

// Not shipped yet: pick a courier and "Ship now". Shipped: AWB, label, manifest, cancel, return, and the live scan history.
export default function ShippingPanel({ order, track, onUpdated, onTrack }) {
  const s = order.shipping || { status: 'not_pushed' };
  const meta = SHIPPING_STATUS[s.status] || SHIPPING_STATUS.not_pushed;
  const booked = s.status === 'booked';
  const provider = PROVIDER_LABEL[s.provider || 'xpressbees'];

  if (order.status === 'cancelled') return null;

  // Prefer the scan list from the latest live check, else the one the server saved
  const details = booked
    ? (track && track.awb === s.awb ? track : { awb: s.awb, status: s.lastTrackStatus, history: s.trackHistory || [], ndr: s.ndr })
    : null;

  return (
    <Card title={booked ? `Shipping (${provider})` : 'Ship now'} action={<Badge tone={meta.tone}>{meta.label}</Badge>}>
      {booked && (
        <dl className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Fact label="Platform" value={provider} />
          <Fact label="Courier" value={s.courierName} />
          <Fact label="AWB number" value={s.awb || 'Pending (fetched automatically)'} />
          <Fact label="Latest courier status" value={s.lastTrackStatus} />
          <Fact label="Payment" value={s.paymentType} />
          <Fact label="Weight" value={s.weight ? `${s.weight} g` : ''} />
          <Fact label="LR number" value={s.lrNumber} />
          <Fact label="Return AWB" value={s.returnAwb} />
        </dl>
      )}
      {booked ? (
        <div className="space-y-4">
          <ShipmentActions order={order} track={track} onTrack={onTrack} onUpdated={onUpdated} />
          <TrackingDetails data={details} />
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-surface-muted p-5">
          <div>
            <p className="font-semibold">This order is not shipped yet</p>
            <p className="mt-1 text-sm text-muted">Compare Surface and Air couriers with their rates and ratings, pick one and ship. The status then follows the courier live.</p>
          </div>
          <Link href={`/orders/${order._id}/ship`}><Button icon={Truck}>Ship now</Button></Link>
        </div>
      )}
    </Card>
  );
}
