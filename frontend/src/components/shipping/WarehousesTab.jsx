'use client';

import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { INDIAN_STATES } from '@/lib/constants';
import useWarehouses from '@/hooks/useWarehouses';
import PincodeInput from '@/components/common/PincodeInput';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import DataTable from '@/components/ui/DataTable';
import { Input } from '@/components/ui/FormField';

const EMPTY = { title: '', name: '', phone: '', email: '', address: '', address2: '', city: '', state: '', pincode: '', isDefault: false };

// Pickup locations. Stored in the CRM and sent with each booking (Shipmozo, Ekart, Delhivery and Shiprocket get them registered automatically).
export default function WarehousesTab() {
  const wh = useWarehouses();
  const [editing, setEditing] = useState(null); // null closed, {} new, record = edit
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const open = editing !== null;

  const openForm = (row) => {
    setEditing(row || {});
    setF(row ? { ...EMPTY, ...row } : EMPTY);
  };
  const close = () => setEditing(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing._id) await api.put(`/shipping/warehouses/${editing._id}`, f);
      else await api.post('/shipping/warehouses', f);
      toast.success(editing._id ? 'Warehouse updated' : 'Warehouse added');
      close();
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

  const makeDefault = async (row) => {
    try {
      await api.put(`/shipping/warehouses/${row._id}`, { ...row, isDefault: true });
      toast.success(`${row.title} is now the default pickup warehouse`);
      wh.reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const columns = [
    { key: 'title', label: 'Title', render: (r) => <span className="font-medium">{r.title}</span> },
    { key: 'name', label: 'Contact', render: (r) => [r.name, r.phone].filter(Boolean).join(' · ') || '-' },
    { key: 'address', label: 'Address', render: (r) => [r.address, r.city, r.state, r.pincode].filter(Boolean).join(', ') },
    {
      key: 'isDefault', label: 'Default',
      render: (r) => (r.isDefault ? <Badge tone="primary">Default</Badge> : <button className="text-xs text-primary hover:underline" onClick={() => makeDefault(r)}>Make default</button>),
    },
    {
      key: 'actions', label: '',
      render: (r) => (
        <div className="flex gap-1">
          <Button size="sm" variant="secondary" icon={Pencil} onClick={() => openForm(r)}>Edit</Button>
          <Button size="sm" variant="ghost" icon={Trash2} className="hover:text-danger" onClick={() => remove(r)} aria-label="Remove" />
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-border p-4">
        <p className="text-sm text-muted">Pickup locations shared by all couriers. Shipmozo, Ekart, Delhivery and Shiprocket get the location registered on their side automatically on the first booking.</p>
        <Button icon={Plus} onClick={() => openForm()}>Add warehouse</Button>
      </div>
      {wh.error ? <p className="p-5 text-sm text-danger">{wh.error}</p>
        : <DataTable columns={columns} rows={wh.rows} loading={wh.loading} emptyTitle="No warehouses yet" emptyDescription="Add a pickup warehouse before booking shipments." />}

      <Modal open={open} onClose={close} title={editing?._id ? 'Edit warehouse' : 'Add warehouse'} size="lg"
        footer={(<><Button variant="secondary" onClick={close}>Cancel</Button><Button type="submit" form="wh-form" loading={busy}>Save warehouse</Button></>)}>
        <form id="wh-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Input wrapperClass="sm:col-span-2" label="Warehouse title" required value={f.title} onChange={set('title')} hint="Must be unique. Sent to the courier as the warehouse name" />
          <Input label="Contact name" required value={f.name} onChange={set('name')} />
          <Input label="Phone" required inputMode="numeric" value={f.phone} onChange={set('phone')} />
          <Input label="Email" type="email" value={f.email} onChange={set('email')} />
          <PincodeInput required value={f.pincode} onChange={(v) => setF((p) => ({ ...p, pincode: v }))}
            onFound={(i) => editing?._id && editing.pincode === i.pincode ? null : setF((p) => ({ ...p, city: i.city || p.city, state: i.state || p.state }))} />
          <Input wrapperClass="sm:col-span-2" label="Address line 1" required value={f.address} onChange={set('address')} />
          <Input wrapperClass="sm:col-span-2" label="Address line 2" value={f.address2} onChange={set('address2')} />
          <Input label="City" required value={f.city} onChange={set('city')} />
          <Input label="State" required list="wh-states" value={f.state} onChange={set('state')} />
          <datalist id="wh-states">{INDIAN_STATES.map((s) => <option key={s} value={s} />)}</datalist>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={!!f.isDefault} onChange={(e) => setF({ ...f, isDefault: e.target.checked })} />
            Make default pickup warehouse
          </label>
        </form>
      </Modal>
    </div>
  );
}
