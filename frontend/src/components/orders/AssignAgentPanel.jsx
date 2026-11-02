'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import useOptions from '@/hooks/useOptions';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Select } from '@/components/ui/FormField';

export default function AssignAgentPanel({ order, onUpdated }) {
  // Prefer agents from the order's zone, fall back to everyone
  const agents = useOptions('/users', { role: 'agent', isActive: true });
  const zones = useOptions('/zones', { isActive: true });
  const [agentId, setAgentId] = useState(order.agent?._id || '');
  const [zoneId, setZoneId] = useState(order.zone?._id || '');
  const [busy, setBusy] = useState(false);

  const run = async (fn, msg) => {
    setBusy(true);
    try {
      onUpdated(await fn());
      toast.success(msg);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const zoneAgents = agents.filter((a) => !order.zone || !a.raw.zone || a.raw.zone === order.zone._id || a.raw.zone?._id === order.zone._id);

  return (
    <Card title="Zone & agent">
      <div className="space-y-4">
        <div className="flex items-end gap-2">
          <Select wrapperClass="flex-1" label="Zone" placeholder="Select zone" options={zones} value={zoneId} onChange={(e) => setZoneId(e.target.value)} />
          <Button variant="secondary" disabled={!zoneId || zoneId === order.zone?._id} loading={busy}
            onClick={() => run(() => api.put(`/orders/${order._id}/zone`, { zoneId }), 'Zone updated')}>Update</Button>
        </div>
        <div className="flex items-end gap-2">
          <Select wrapperClass="flex-1" label={order.agent ? 'Reassign agent' : 'Assign agent'} placeholder="Select agent"
            options={zoneAgents.length ? zoneAgents : agents} value={agentId} onChange={(e) => setAgentId(e.target.value)} />
          <Button disabled={!agentId || agentId === order.agent?._id} loading={busy}
            onClick={() => run(() => api.put(`/orders/${order._id}/assign-agent`, { agentId }), 'Agent assigned')}>
            {order.agent ? 'Reassign' : 'Assign'}
          </Button>
        </div>
        {order.agent && <p className="text-xs text-muted">Current agent: {order.agent.name} · {order.agent.mobile || 'no mobile'}</p>}
      </div>
    </Card>
  );
}
