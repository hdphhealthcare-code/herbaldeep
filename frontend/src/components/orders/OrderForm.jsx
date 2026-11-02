'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { todayISO } from '@/lib/format';
import useOptions from '@/hooks/useOptions';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Select, Input, Textarea } from '@/components/ui/FormField';
import CustomerPicker from './CustomerPicker';
import OrderItemsEditor from './OrderItemsEditor';

const EMPTY_CUSTOMER = { name: '', mobile: '', city: '', area: '', state: '', pincode: '', address: '' };

export default function OrderForm() {
  const router = useRouter();
  const customers = useOptions('/customers', { limit: 100 });
  const products = useOptions('/products', { isActive: true });
  const zones = useOptions('/zones', { isActive: true });

  const [mode, setMode] = useState('existing');
  const [customerId, setCustomerId] = useState('');
  const [customer, setCustomer] = useState(EMPTY_CUSTOMER);
  const [items, setItems] = useState([{ product: '', quantity: 1 }]);
  const [zoneId, setZoneId] = useState('');
  const [orderDate, setOrderDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        items: items.map((i) => ({ product: i.product, quantity: Number(i.quantity) })),
        zoneId: zoneId || undefined,
        orderDate,
        notes,
        ...(mode === 'existing' ? { customerId } : { customer }),
      };
      const order = await api.post('/orders', body);
      toast.success(`Order ${order.orderId} created`);
      router.push(`/orders/${order._id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card title="1. Customer details">
        <CustomerPicker
          mode={mode} setMode={setMode} customerId={customerId} setCustomerId={setCustomerId}
          customer={customer} setCustomer={setCustomer} customers={customers}
        />
      </Card>
      <Card title="2. Products & order details">
        <OrderItemsEditor items={items} onChange={setItems} products={products} />
      </Card>
      <Card title="3. Zone & notes">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Zone" placeholder="Auto-identify from customer city / area" value={zoneId}
            options={zones} onChange={(e) => setZoneId(e.target.value)}
            hint="Leave empty to match automatically using the zone service areas"
          />
          <Input label="Order date" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
          <Textarea wrapperClass="sm:col-span-2" label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </Card>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" loading={saving}>Create order</Button>
      </div>
    </form>
  );
}
