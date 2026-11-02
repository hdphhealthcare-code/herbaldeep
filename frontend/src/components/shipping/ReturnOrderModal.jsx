'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import useFetch from '@/hooks/useFetch';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/FormField';

const REQUESTS = [{ value: 'REFUND', label: 'Refund' }, { value: 'REPLACEMENT', label: 'Replacement' }];

// Return pickup. Ekart takes a free-text reason; Shipmozo asks for a reason + customer request (weight in kg); Xpressbees only needs category + weight (grams).
export default function ReturnOrderModal({ open, order, providerId, caps, onClose, onUpdated }) {
  const reasons = useFetch(open && caps.returnReasons ? `/shipping/return-reasons?provider=${providerId}` : null);
  const [f, setF] = useState({ returnReasonId: '', customerRequest: 'REFUND', reasonComment: '', category: 'Healthcare', weight: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const shipmozo = providerId === 'shipmozo';
  const ekart = providerId === 'ekart';

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post(`/shipping/orders/${order._id}/return`, f);
      const r = res.result;
      toast.success(r.returnAwb ? `Return booked. AWB ${r.returnAwb}` : 'Return order created');
      if (r.note) toast(r.note, { duration: 7000 });
      onUpdated(res.order);
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create return pickup"
      footer={(<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="return-form" loading={busy}>Create return</Button></>)}>
      <form id="return-form" onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted">The courier will pick the items up from the customer address of {order.orderId}.</p>
        {ekart ? (
          <>
            <Input label="Return reason" required value={f.reason} onChange={set('reason')} hint="Sent to Ekart, for example: Item is damaged" />
            <Input label="Package weight (grams)" type="number" min="1" value={f.weight} onChange={set('weight')} hint="Leave blank to reuse the original weight" />
          </>
        ) : shipmozo ? (
          <>
            <Select label="Return reason" required placeholder={reasons.loading ? 'Loading...' : 'Select reason'}
              options={(reasons.data || []).map((r) => ({ value: r.id, label: r.title }))} value={f.returnReasonId} onChange={set('returnReasonId')} />
            <Select label="Customer request" options={REQUESTS} value={f.customerRequest} onChange={set('customerRequest')} />
            <Input label="Package weight (kg)" type="number" step="any" min="0" value={f.weight} onChange={set('weight')} hint="Leave blank to reuse the original weight" />
            <Textarea label="Comments" rows={2} value={f.reasonComment} onChange={set('reasonComment')} />
          </>
        ) : (
          <>
            <Input label="Product category" value={f.category} onChange={set('category')} />
            <Input label="Package weight (grams)" type="number" min="1" value={f.weight} onChange={set('weight')} hint="Leave blank to reuse the original weight" />
          </>
        )}
      </form>
    </Modal>
  );
}
