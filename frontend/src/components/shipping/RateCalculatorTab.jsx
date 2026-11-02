'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import Button from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/FormField';
import RateList from './RateList';

const PAYMENT = [{ value: 'PREPAID', label: 'Prepaid' }, { value: 'COD', label: 'Cash on delivery' }];

// Rate calculator for any route (no order needed). Asks every connected courier at once.
export default function RateCalculatorTab() {
  const [f, setF] = useState({
    origin: '', destination: '', paymentType: 'PREPAID', orderAmount: '', weight: 500, length: 10, width: 10, height: 10,
  });
  const [groups, setGroups] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      setGroups(await api.post('/shipping/rate-calculator', f));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <form onSubmit={submit} className="grid gap-4 border-b border-border p-5 sm:grid-cols-4">
        <Input label="Pickup pincode" required maxLength={6} value={f.origin} onChange={set('origin')} />
        <Input label="Delivery pincode" required maxLength={6} value={f.destination} onChange={set('destination')} />
        <Select label="Payment" options={PAYMENT} value={f.paymentType} onChange={set('paymentType')} />
        <Input label="Order value (INR)" type="number" min="0" required value={f.orderAmount} onChange={set('orderAmount')} />
        <Input label="Weight (g)" type="number" min="1" required value={f.weight} onChange={set('weight')} />
        <Input label="Length (cm)" type="number" min="1" required value={f.length} onChange={set('length')} />
        <Input label="Width (cm)" type="number" min="1" required value={f.width} onChange={set('width')} />
        <Input label="Height (cm)" type="number" min="1" required value={f.height} onChange={set('height')} />
        <div className="flex items-end"><Button type="submit" loading={busy}>Compare rates</Button></div>
      </form>
      {groups && <div className="p-5"><RateList groups={groups} /></div>}
    </div>
  );
}
