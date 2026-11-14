import { Check } from 'lucide-react';
import Card from '@/components/ui/Card';
import LiveBadge from '@/components/common/LiveBadge';
import { FINAL_STATUS, TRACK_STEPS } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';

const SPECIAL = {
  ndr: { text: 'Delivery attempt failed. The NDR team can ask the courier for a re-attempt.', cls: 'bg-danger-soft text-danger' },
  new_order: { text: 'Waiting for confirmation. Once confirmed, an admin can ship it.', cls: 'bg-info-soft text-info' },
  agent_assigned: { text: 'Waiting for confirmation. Once confirmed, an admin can ship it.', cls: 'bg-info-soft text-info' },
  confirmed: { text: 'Confirmed. Waiting for an admin to ship it.', cls: 'bg-success-soft text-success' },
  rto: { text: 'The parcel is on its way back to your warehouse (RTO).', cls: 'bg-danger-soft text-danger' },
  rto_delivered: { text: 'The parcel was returned to your warehouse.', cls: 'bg-surface-muted text-muted' },
  cancelled: { text: 'This order was cancelled.', cls: 'bg-danger-soft text-danger' },
  invoice_generated: { text: 'Delivered and invoiced.', cls: 'bg-success-soft text-success' },
};

/**
 * Read-only progress tracker. The status is NOT edited by hand: after booking it follows the courier by itself,
 * and this card shows the courier's own latest wording.
 */
export default function OrderLiveStatus({ order, updatedAt }) {
  const s = order.shipping || {};
  const status = order.status === 'invoice_generated' ? 'delivered' : order.status;
  const idx = TRACK_STEPS.findIndex((t) => t.value === status);
  const final = FINAL_STATUS.includes(order.status);
  const special = SPECIAL[order.status];

  return (
    <Card title="Live status" action={<LiveBadge updatedAt={updatedAt} live={!final} />}>
      <ol className="space-y-0">
        {TRACK_STEPS.map((step, i) => {
          const done = idx >= 0 && i < idx;
          const current = i === idx;
          return (
            <li key={step.value} className="relative flex gap-3 pb-4 last:pb-0">
              {i < TRACK_STEPS.length - 1 && <span className={`absolute left-[11px] top-6 h-full w-px ${done ? 'bg-success' : 'bg-border'}`} />}
              <span className={`relative z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                done ? 'bg-success text-primary-foreground' : current ? 'bg-primary text-primary-foreground ring-4 ring-primary-soft' : 'bg-surface-muted text-muted'}`}>
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={`pt-0.5 text-sm ${current ? 'font-semibold text-foreground' : done ? 'text-foreground' : 'text-muted'}`}>{step.label}</span>
            </li>
          );
        })}
      </ol>

      {special && <p className={`mt-4 rounded-lg p-3 text-xs ${special.cls}`}>{special.text}</p>}

      <div className="mt-4 rounded-lg border border-border bg-surface-muted p-3 text-xs">
        {s.lastTrackStatus ? (
          <>
            <p className="text-muted">Courier says</p>
            <p className="mt-0.5 text-sm font-semibold">{s.lastTrackStatus}</p>
            {s.lastTrackedAt && <p className="mt-0.5 text-muted">Checked {formatDateTime(s.lastTrackedAt)}</p>}
          </>
        ) : (
          <p className="text-muted">
            {s.status === 'booked' ? 'Waiting for the first courier update.' : 'An admin ships the order after it is confirmed. The status then updates by itself.'}
          </p>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">Status updates automatically from the courier. It cannot be changed by hand.</p>
    </Card>
  );
}
