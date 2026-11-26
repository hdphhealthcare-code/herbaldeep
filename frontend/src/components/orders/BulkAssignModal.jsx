'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Select } from '@/components/ui/FormField';

// Admin: give the selected orders to one agent (that agent then sees them; the previous agent no longer does)
export default function BulkAssignModal({ open, ids, agents, onClose, onDone }) {
  const [agentId, setAgentId] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setAgentId(''); }, [open]);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await api.post('/orders/bulk/assign-agent', { ids, agentId });
      onDone(res);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Assign ${ids.length} order(s) to an agent`}
      footer={(<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!agentId} loading={busy} onClick={submit}>Assign</Button></>)}>
      <Select label="Agent" placeholder="Select agent" options={agents} value={agentId} onChange={(e) => setAgentId(e.target.value)}
        hint="An order's agent can be changed only once. Orders that already used their change are skipped and listed afterwards." />
    </Modal>
  );
}
