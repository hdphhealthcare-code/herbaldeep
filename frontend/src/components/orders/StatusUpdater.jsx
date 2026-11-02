'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { ORDER_STATUS, AGENT_STATUS_OPTIONS } from '@/lib/constants';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Select, Input } from '@/components/ui/FormField';

export default function StatusUpdater({ order, isAgent, onUpdated }) {
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const options = (isAgent ? AGENT_STATUS_OPTIONS : ORDER_STATUS).filter((s) => s.value !== order.status);
  const locked = order.status === 'cancelled';

  const submit = async () => {
    if (status === 'cancelled' && !window.confirm('Cancel this order? Reserved stock will be returned to inventory.')) return;
    setBusy(true);
    try {
      onUpdated(await api.put(`/orders/${order._id}/status`, { status, note }));
      toast.success('Status updated');
      setStatus('');
      setNote('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Update status">
      {locked ? (
        <p className="text-sm text-muted">This order is cancelled and can no longer be changed.</p>
      ) : (
        <div className="space-y-3">
          <Select placeholder="Select new status" options={options} value={status} onChange={(e) => setStatus(e.target.value)} />
          <Input placeholder="Add a note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button className="w-full" disabled={!status} loading={busy} variant={status === 'cancelled' ? 'danger' : 'primary'} onClick={submit}>
            Update status
          </Button>
        </div>
      )}
    </Card>
  );
}
