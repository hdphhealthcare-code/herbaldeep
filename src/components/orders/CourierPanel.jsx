'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { toInputDate } from '@/lib/format';
import { DISPATCH_STATUS, DELIVERY_STATUS } from '@/lib/constants';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/FormField';

export default function CourierPanel({ order, onUpdated }) {
  const c = order.courier || {};
  const [form, setForm] = useState({
    partner: c.partner || '', awb: c.awb || '', dispatchDate: toInputDate(c.dispatchDate),
    dispatchStatus: c.dispatchStatus || 'pending', deliveryStatus: c.deliveryStatus || 'pending', remarks: c.remarks || '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      onUpdated(await api.put(`/orders/${order._id}/courier`, form));
      toast.success('Courier details saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Courier / dispatch">
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Input label="Courier partner" value={form.partner} onChange={set('partner')} />
        <Input label="Tracking / AWB number" value={form.awb} onChange={set('awb')} />
        <Input label="Dispatch date" type="date" value={form.dispatchDate} onChange={set('dispatchDate')} />
        <Select label="Dispatch status" options={DISPATCH_STATUS} value={form.dispatchStatus} onChange={set('dispatchStatus')} />
        <Select label="Delivery status" options={DELIVERY_STATUS} value={form.deliveryStatus} onChange={set('deliveryStatus')} />
        <Textarea wrapperClass="sm:col-span-2" label="Courier remarks" rows={2} value={form.remarks} onChange={set('remarks')} />
        <div className="sm:col-span-2"><Button type="submit" loading={busy}>Save courier details</Button></div>
      </form>
    </Card>
  );
}
