'use client';

import { useState } from 'react';
import { AlertTriangle, ClipboardList, FileText, MapPin, Undo2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { openLabel } from '@/lib/shipping';
import useProviders from '@/hooks/useProviders';
import Button from '@/components/ui/Button';
import TrackingDetails from './TrackingDetails';
import ReturnOrderModal from './ReturnOrderModal';
import NdrActionModal from './NdrActionModal';

// Track Shipment, label, manifest (if the courier has one), Cancel Shipment, return pickup
export default function ShipmentActions({ order, onUpdated }) {
  const s = order.shipping;
  const providerId = s.provider || 'xpressbees';
  const providers = useProviders();
  const caps = providers.byId[providerId]?.capabilities || {};
  const base = `/shipping/orders/${order._id}`;
  const [busy, setBusy] = useState('');
  const [tracking, setTracking] = useState(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [ndrOpen, setNdrOpen] = useState(false);
  const ndrActions = (tracking?.ndr?.actions || []).filter((a) => a === 'Re-Attempt' || a === 'RTO');

  const run = async (key, fn) => {
    setBusy(key);
    try { await fn(); } catch (err) { toast.error(err.message); } finally { setBusy(''); }
  };

  const track = () => run('track', async () => {
    const res = await api.get(`${base}/track`);
    setTracking(res.result);
    onUpdated(res.order);
  });
  const label = () => run('label', () => openLabel(order._id));
  const manifest = () => run('manifest', async () => {
    const res = await api.post(`${base}/manifest`);
    toast.success('Manifest generated');
    onUpdated(res.order);
  });
  const cancel = () => run('cancel', async () => {
    if (!window.confirm(`Cancel the shipment${s.awb ? ` with AWB ${s.awb}` : ''}?`)) return;
    const res = await api.post(`${base}/cancel`);
    toast.success('Shipment cancelled');
    setTracking(null);
    onUpdated(res.order);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" icon={MapPin} loading={busy === 'track'} onClick={track}>Track shipment</Button>
        {s.awb && <Button variant="secondary" icon={FileText} loading={busy === 'label'} onClick={label}>Shipping label</Button>}
        {caps.manifest && (
          <Button variant="secondary" icon={ClipboardList} loading={busy === 'manifest'} onClick={manifest}>Pickup manifest</Button>
        )}
        <Button variant="secondary" icon={Undo2} disabled={s.returnPushed || !s.awb} onClick={() => setReturnOpen(true)}>
          {s.returnPushed ? 'Return created' : 'Create return'}
        </Button>
        {caps.ndrAction && ndrActions.length > 0 && (
          <Button variant="secondary" icon={AlertTriangle} onClick={() => setNdrOpen(true)}>NDR action</Button>
        )}
        <Button variant="danger" icon={XCircle} loading={busy === 'cancel'} onClick={cancel} disabled={!s.awb}>Cancel shipment</Button>
      </div>
      {!s.awb && <p className="text-xs text-muted">The AWB is not available yet. Press Track shipment to fetch it, then label and cancel become available.</p>}
      {s.manifestUrl && (
        <p className="text-xs text-muted">
          Manifest / pickup sheet:{' '}
          <a href={s.manifestUrl} target="_blank" rel="noreferrer" className="font-medium text-primary underline">open PDF</a>
        </p>
      )}
      <TrackingDetails data={tracking} />
      <NdrActionModal open={ndrOpen} order={order} actions={ndrActions} onClose={() => setNdrOpen(false)} onUpdated={onUpdated} />
      <ReturnOrderModal open={returnOpen} order={order} providerId={providerId} caps={caps} onClose={() => setReturnOpen(false)} onUpdated={onUpdated} />
    </div>
  );
}
