'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import useWarehouses from '@/hooks/useWarehouses';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import DataTable from '@/components/ui/DataTable';
import { Input } from '@/components/ui/FormField';

const EMPTY = { title: '', name: '', phone: '', email: '', address: '', address2: '', city: '', state: '', pincode: '', isDefault: false };

// Pickup locations. Xpressbees has no warehouse API, so these are stored in the CRM and sent with each booking.
export default function WarehousesTab() {
  const wh = useWarehouses();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/shipping/warehouses', f);
      toast.success('Warehouse added');
      setOpen(false);
      setF(EMPTY);
      wh.reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Remove warehouse "${row.title}"?`)) return;
    try {
      await api.del(`/shipping/warehouses/${row._id}`);
      toast.success('Warehouse removed');
      wh.reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const columns = [
    { key: 'title', label: 'Title', render: (r) => <span className="font-medium">{r.title}</span> },
    { key: 'name', label: 'Contact', render: (r) => [r.name, r.phone].filter(Boolean).join(' · ') || '-' },
    { key: 'address', label: 'Address', render: (r) => [r.address, r.city, r.state, r.pincode].filter(Boolean).join(', ') },
    { key: 'isDefault', label: 'Default', render: (r) => (r.isDefault ? <Badge tone="primary">Default</Badge> : '-') },
    { key: 'actions', label: '', render: (r) => <Button size="sm" variant="secondary" icon={Trash2} onClick={() => remove(r)}>Remove</Button> },
  ];

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border p-4">
        <p className="text-sm text-muted">Pickup locations shared by all couriers. Shipmozo gets the warehouse created on its panel automatically on the first booking.</p>
        <Button icon={Plus} onClick={() => setOpen(true)}>Add warehouse</Button>
      </div>
      {wh.error ? <p className="p-5 text-sm text-danger">{wh.error}</p>
        : <DataTable columns={columns} rows={wh.rows} loading={wh.loading} emptyTitle="No warehouses yet" emptyDescription="Add a pickup warehouse before booking shipments." />}

      <Modal open={open} onClose={() => setOpen(false)} title="Add warehouse" size="lg"
        footer={(<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" form="wh-form" loading={busy}>Save warehouse</Button></>)}>
        <form id="wh-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Input wrapperClass="sm:col-span-2" label="Warehouse title" required value={f.title} onChange={set('title')} hint="Must be unique. Sent to Xpressbees as the warehouse name" />
          <Input label="Contact name" required value={f.name} onChange={set('name')} />
          <Input label="Phone" required value={f.phone} onChange={set('phone')} />
          <Input label="Email" type="email" value={f.email} onChange={set('email')} />
          <Input wrapperClass="sm:col-span-2" label="Address line 1" required value={f.address} onChange={set('address')} />
          <Input wrapperClass="sm:col-span-2" label="Address line 2" value={f.address2} onChange={set('address2')} />
          <Input label="City" required value={f.city} onChange={set('city')} />
          <Input label="State" required value={f.state} onChange={set('state')} />
          <Input label="Pincode" required maxLength={6} value={f.pincode} onChange={set('pincode')} />
          <label className="flex items-center gap-2 text-sm sm:pt-7">
            <input type="checkbox" checked={f.isDefault} onChange={(e) => setF({ ...f, isDefault: e.target.checked })} />
            Make default pickup warehouse
          </label>
        </form>
      </Modal>
    </div>
  );
}
