'use client';

import { useState } from 'react';
import { AlertTriangle, ClipboardList, FileText, RefreshCw, Undo2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { CANCELLABLE_STATUS } from '@/lib/constants';
import useProviders from '@/hooks/useProviders';
import Button from '@/components/ui/Button';
import ReturnOrderModal from './ReturnOrderModal';
import NdrActionModal from './NdrActionModal';
import LabelModal from './LabelModal';

// Refresh status, label, manifest (if the courier has one), cancel shipment (before pickup), return pickup, NDR action
export default function ShipmentActions({ order, track, onTrack, onUpdated }) {
  const s = order.shipping;
  const providerId = s.provider || 'xpressbees';
  const providers = useProviders();
  const caps = providers.byId[providerId]?.capabilities || {};
  const base = `/shipping/orders/${order._id}`;
  const [busy, setBusy] = useState('');
  const [returnOpen, setReturnOpen] = useState(false);
  const [ndrOpen, setNdrOpen] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);
  const ndrActions = (track?.ndr?.actions || s.ndr?.actions || []).filter((a) => a === 'Re-Attempt' || a === 'RTO');
  const canCancel = Boolean(s.awb) && CANCELLABLE_STATUS.includes(order.status);

  const run = async (key, fn) => {
    setBusy(key);
    try { await fn(); } catch (err) { toast.error(err.message); } finally { setBusy(''); }
  };

  const refresh = () => run('track', async () => {
    const res = await api.get(`${base}/track`);
    onTrack(res.result);
    onUpdated(res.order);
    toast.success('Status refreshed from the courier');
  });
  const manifest = () => run('manifest', async () => {
    const res = await api.post(`${base}/manifest`);
    toast.success(providerId === 'delhivery' ? 'Pickup requested' : 'Manifest generated');
    onUpdated(res.order);
  });
  const cancel = () => run('cancel', async () => {
    if (!window.confirm(`Cancel the shipment${s.awb ? ` with AWB ${s.awb}` : ''}? The order goes back to the step before shipping.`)) return;
    const res = await api.post(`${base}/cancel`);
    toast.success('Shipment cancelled');
    onTrack(null);
    onUpdated(res.order);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" icon={RefreshCw} loading={busy === 'track'} onClick={refresh}>Refresh status</Button>
        {s.awb && <Button variant="secondary" icon={FileText} onClick={() => setLabelOpen(true)}>Shipping label</Button>}
        {caps.manifest && (
          <Button variant="secondary" icon={ClipboardList} loading={busy === 'manifest'} onClick={manifest}>{providerId === 'delhivery' ? 'Request pickup' : 'Pickup manifest'}</Button>
        )}
        <Button variant="secondary" icon={Undo2} disabled={s.returnPushed || !s.awb || caps.returns === false} title={caps.returns === false ? 'Create the return from the courier panel' : undefined} onClick={() => setReturnOpen(true)}>
          {s.returnPushed ? 'Return created' : 'Create return'}
        </Button>
        {caps.ndrAction && ndrActions.length > 0 && (
          <Button variant="secondary" icon={AlertTriangle} onClick={() => setNdrOpen(true)}>NDR action</Button>
        )}
        {canCancel && <Button variant="danger" icon={XCircle} loading={busy === 'cancel'} onClick={cancel}>Cancel shipment</Button>}
      </div>
      {!s.awb && <p className="text-xs text-muted">The AWB is not available yet. It is fetched automatically and appears here; you can also press Refresh status.</p>}
      {!canCancel && s.awb && <p className="text-xs text-muted">Once the courier has picked the parcel up, the shipment can no longer be cancelled.</p>}
      {s.manifestUrl && (
        <p className="text-xs text-muted">
          Manifest / pickup sheet:{' '}
          <a href={s.manifestUrl} target="_blank" rel="noreferrer" className="font-medium text-primary underline">open PDF</a>
        </p>
      )}
      <LabelModal open={labelOpen} order={order} onClose={() => setLabelOpen(false)} />
      <NdrActionModal open={ndrOpen} order={order} actions={ndrActions} onClose={() => setNdrOpen(false)} onUpdated={onUpdated} />
      <ReturnOrderModal open={returnOpen} order={order} providerId={providerId} caps={caps} onClose={() => setReturnOpen(false)} onUpdated={onUpdated} />
    </div>
  );
}
