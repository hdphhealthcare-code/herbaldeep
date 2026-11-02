'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calculator, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import useWarehouses from '@/hooks/useWarehouses';
import useProviders from '@/hooks/useProviders';
import Button from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/FormField';
import RateList from './RateList';

const PAYMENT = [{ value: 'PREPAID', label: 'Prepaid' }, { value: 'COD', label: 'Cash on delivery' }];

// Compare courier rates across every configured courier platform, pick one (or "Auto"), and book the shipment.
export default function BookShipmentForm({ order, onUpdated }) {
  const wh = useWarehouses();
  const providers = useProviders();
  const c = order.customer || {};
  const missing = [!c.pincode && 'pincode', !c.state && 'state'].filter(Boolean);
  const [f, setF] = useState({
    warehouseId: '', provider: '', courierId: '', paymentType: 'PREPAID', codAmount: order.totalAmount,
    weight: 500, length: 10, width: 10, height: 10, autoPickup: true,
  });
  const [groups, setGroups] = useState(null);
  const [busy, setBusy] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const providerOptions = providers.list.map((p) => ({ value: p.id, label: p.configured ? p.label : `${p.label} (not configured)`, disabled: !p.configured }));
  const current = providers.byId[f.provider];

  useEffect(() => {
    if (!f.warehouseId && wh.defaultId) setF((p) => ({ ...p, warehouseId: wh.defaultId }));
  }, [wh.defaultId, f.warehouseId]);
  useEffect(() => {
    if (!f.provider && providers.configured[0]) setF((p) => ({ ...p, provider: providers.configured[0].id }));
  }, [providers.configured, f.provider]);

  const run = async (key, fn) => {
    setBusy(key);
    try { await fn(); } catch (err) { toast.error(err.message); } finally { setBusy(''); }
  };

  const fetchRates = () => run('rates', async () => {
    if (!f.warehouseId) throw new Error('Select a pickup warehouse first');
    setGroups(await api.post(`/shipping/orders/${order._id}/rates`, f));
    setF((p) => ({ ...p, courierId: '' }));
  });

  const book = (e) => {
    e.preventDefault();
    return run('book', async () => {
      const res = await api.post(`/shipping/orders/${order._id}/book`, f);
      const r = res.result;
      toast.success(r.awb ? `Booked with ${r.providerLabel}. AWB ${r.awb}` : `Booked with ${r.providerLabel}. AWB is pending, press Track shipment in a minute`);
      onUpdated(res.order);
    });
  };

  if (missing.length) {
    return (
      <p className="rounded-lg bg-warning-soft p-3 text-sm text-warning">
        Customer {missing.join(' and ')} missing. Couriers need it to ship. Add it in{' '}
        <Link href="/customers" className="font-medium underline">Customers</Link>, then reload this page.
      </p>
    );
  }
  if (!providers.loading && !providers.configured.length) {
    return (
      <p className="rounded-lg bg-warning-soft p-3 text-sm text-warning">
        No courier is connected. Add the Xpressbees and/or Shipmozo keys in backend/.env and restart the server.
      </p>
    );
  }

  return (
    <form onSubmit={book} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {wh.error && <p className="rounded-lg bg-danger-soft p-3 text-sm text-danger sm:col-span-2">{wh.error}</p>}
        <Select wrapperClass="sm:col-span-2" label="Pickup warehouse" required placeholder={wh.loading ? 'Loading...' : 'Select warehouse'}
          options={wh.options} value={f.warehouseId} onChange={set('warehouseId')}
          hint="Add warehouses from the Shipping page" />
        <Select label="Courier platform" options={providerOptions} value={f.provider}
          onChange={(e) => setF({ ...f, provider: e.target.value, courierId: '' })}
          hint={current?.autoHint} />
        <Select label="Payment type" options={PAYMENT} value={f.paymentType} onChange={set('paymentType')} />
        {f.paymentType === 'COD' && <Input label="COD amount (INR)" type="number" min="0" value={f.codAmount} onChange={set('codAmount')} />}
        <Input label="Weight (grams)" type="number" min="1" required value={f.weight} onChange={set('weight')} />
        <div className="grid grid-cols-3 gap-3 sm:col-span-2">
          <Input label="Length (cm)" type="number" min="1" required value={f.length} onChange={set('length')} />
          <Input label="Width (cm)" type="number" min="1" required value={f.width} onChange={set('width')} />
          <Input label="Height (cm)" type="number" min="1" required value={f.height} onChange={set('height')} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" icon={Calculator} variant="secondary" loading={busy === 'rates'} onClick={fetchRates}>Compare courier rates</Button>
          <p className="text-xs text-muted">Optional. Shows every connected courier. Pick a row to book that exact courier.</p>
        </div>
        {groups && (
          <RateList groups={groups} selected={{ provider: f.provider, courierId: f.courierId }}
            onSelect={(provider, courierId) => setF({ ...f, provider, courierId })} />
        )}
      </div>

      {current?.id === 'xpressbees' && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.autoPickup} onChange={(e) => setF({ ...f, autoPickup: e.target.checked })} />
          Request pickup automatically
        </label>
      )}
      <Button type="submit" icon={Truck} loading={busy === 'book'} disabled={!f.provider}>
        Book shipment{current ? ` with ${current.label}` : ''}
      </Button>
    </form>
  );
}
