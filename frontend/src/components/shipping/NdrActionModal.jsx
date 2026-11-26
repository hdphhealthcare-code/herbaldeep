'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/FormField';

const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

// Ekart NDR action for one shipment: re-attempt delivery (optionally with a new phone / address) or return to origin
export default function NdrActionModal({ open, order, actions, onClose, onUpdated }) {
  const [f, setF] = useState({ action: '', date: order.shipping?.provider === 'delhivery' ? '' : day(1), phone: '', address: '', instructions: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const action = f.action || actions[0] || '';
  const delhivery = order.shipping?.provider === 'delhivery'; // date optional, no phone / address update

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post(`/shipping/orders/${order._id}/ndr`, { ...f, action });
      toast.success(res.result?.remark || 'NDR action submitted');
      onUpdated(res.order);
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`NDR action · ${order.shipping?.awb || ''}`}
      footer={(<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="ekart-ndr-form" loading={busy}>Submit</Button></>)}>
      <form id="ekart-ndr-form" onSubmit={submit} className="space-y-4">
        <Select label="Action" options={actions.map((a) => ({ value: a, label: a === 'RTO' ? 'Return to origin (RTO)' : 'Re-attempt delivery' }))}
          value={action} onChange={set('action')} />
        {action === 'Re-Attempt' && (
          <>
            <Input label={delhivery ? 'Re-attempt date (optional)' : 'Re-attempt date'} type="date" required={!delhivery} min={day(1)} max={day(7)} value={f.date} onChange={set('date')}
              hint={delhivery ? 'Leave empty to ask for the next attempt as soon as possible' : 'Within the next 7 days, not today'} />
            {!delhivery && <Input label="Updated phone (optional)" maxLength={10} value={f.phone} onChange={set('phone')} />}
            {!delhivery && <Textarea label="Updated address (optional)" rows={2} value={f.address} onChange={set('address')} />}
          </>
        )}
        <Textarea label="Instructions (optional)" rows={2} value={f.instructions} onChange={set('instructions')} />
      </form>
    </Modal>
  );
}
