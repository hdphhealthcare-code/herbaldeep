'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { FINAL_STATUS, MAX_AGENT_CHANGES } from '@/lib/constants';
import useOptions from '@/hooks/useOptions';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Select } from '@/components/ui/FormField';

/**
 * Assign an agent, and change it. The agent can be changed only MAX_AGENT_CHANGES time(s) (once);
 * after that the assignment is locked. The server enforces the same rule.
 */
export default function AssignAgentPanel({ order, onUpdated }) {
  const agents = useOptions('/users', { role: 'agent', isActive: true });
  const [agentId, setAgentId] = useState('');
  const [busy, setBusy] = useState(false);

  const finished = FINAL_STATUS.includes(order.status);
  const used = order.agentChanges || 0;
  const left = order.agentChangesLeft ?? Math.max(MAX_AGENT_CHANGES - used, 0);
  const locked = Boolean(order.agent) && (order.agentLocked ?? left === 0);
  const reassigning = Boolean(order.agent);
  const options = agents.filter((a) => a.value !== order.agent?._id);

  const submit = async () => {
    if (reassigning && !window.confirm(`Change the agent to ${agents.find((a) => a.value === agentId)?.label}?\n\nThe agent can be changed only once. After this the assignment is locked.`)) return;
    setBusy(true);
    try {
      onUpdated(await api.put(`/orders/${order._id}/assign-agent`, { agentId }));
      toast.success(reassigning ? 'Agent changed. The assignment is now locked' : 'Agent assigned');
      setAgentId('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Agent">
      <div className="space-y-4">
        {order.agent ? (
          <div className="rounded-lg border border-border bg-surface-muted p-3 text-sm">
            <p className="font-semibold">{order.agent.name}</p>
            <p className="text-xs text-muted">{order.agent.mobile || 'No mobile number'}</p>
          </div>
        ) : <p className="text-sm text-muted">No agent assigned yet.</p>}

        {finished ? (
          <p className="text-xs text-muted">This order is finished, so the agent can no longer be changed.</p>
        ) : locked ? (
          <p className="flex items-start gap-2 rounded-lg bg-surface-muted p-3 text-xs text-muted">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            The agent was changed once and is now locked. It cannot be changed again.
          </p>
        ) : (
          <>
            <Select label={reassigning ? 'Change agent' : 'Assign agent'} placeholder="Select agent" options={options} value={agentId} onChange={(e) => setAgentId(e.target.value)}
              hint={reassigning ? `${left} change left. After that the agent is locked.` : `You can change the agent ${MAX_AGENT_CHANGES} time after assigning.`} />
            <Button className="w-full" disabled={!agentId} loading={busy} onClick={submit}>{reassigning ? 'Change agent' : 'Assign agent'}</Button>
          </>
        )}
      </div>
    </Card>
  );
}
