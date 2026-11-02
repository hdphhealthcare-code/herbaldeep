'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import useFetch from '@/hooks/useFetch';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import DataTable from '@/components/ui/DataTable';
import { Input, Select } from '@/components/ui/FormField';

const ACTIONS = [
  { value: 're-attempt', label: 'Re-attempt delivery' },
  { value: 'change_address', label: 'Change address' },
  { value: 'change_phone', label: 'Change phone' },
];

// NDR / Exception List + Create NDR / Exception action
export default function NdrTab() {
  const ndr = useFetch('/shipping/ndr');
  const [row, setRow] = useState(null);
  const [f, setF] = useState({ action: 're-attempt', date: '', name: '', address_1: '', address_2: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const actionData = () => {
    if (f.action === 're-attempt') return { re_attempt_date: f.date };
    if (f.action === 'change_address') return { name: f.name, address_1: f.address_1, address_2: f.address_2 };
    return { phone: f.phone };
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post('/shipping/ndr', [{ awb: row.awb_number, action: f.action, action_data: actionData() }]);
      const r = res[0] || {};
      if (r.status === false) throw new Error(r.message || 'NDR action failed');
      toast.success(r.message || 'NDR submitted');
      setRow(null);
      ndr.reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'awb_number', label: 'AWB', render: (r) => <span className="font-medium">{r.awb_number}</span> },
    { key: 'orderId', label: 'CRM order' },
    { key: 'event_date', label: 'Date' },
    { key: 'courier_remarks', label: 'Courier remarks' },
    { key: 'total_attempts', label: 'Attempts' },
    { key: 'actions', label: '', render: (r) => <Button size="sm" onClick={() => setRow(r)}>Take action</Button> },
  ];

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border p-4">
        <p className="text-sm text-muted">Xpressbees shipments where the courier raised an exception. For Ekart, open the order: after Track shipment shows an exception, an NDR action button appears. Shipmozo has no NDR API (use its panel). You can act only while the exception is open.</p>
        <Button variant="secondary" onClick={ndr.reload}>Refresh</Button>
      </div>
      {ndr.error ? <p className="p-5 text-sm text-danger">{ndr.error}</p>
        : <DataTable columns={columns} rows={ndr.data || []} rowKey="awb_number" loading={ndr.loading} emptyTitle="No NDR / exceptions" emptyDescription="Nothing needs your action right now." />}

      <Modal open={!!row} onClose={() => setRow(null)} title={`NDR action · AWB ${row?.awb_number || ''}`}
        footer={(<><Button variant="secondary" onClick={() => setRow(null)}>Cancel</Button><Button type="submit" form="ndr-form" loading={busy}>Submit</Button></>)}>
        <form id="ndr-form" onSubmit={submit} className="space-y-4">
          {row?.courier_remarks && <p className="text-sm text-muted">Courier remark: {row.courier_remarks}</p>}
          <Select label="Action" options={ACTIONS} value={f.action} onChange={set('action')} />
          {f.action === 're-attempt' && <Input label="Re-attempt date" type="date" required value={f.date} onChange={set('date')} />}
          {f.action === 'change_address' && (
            <>
              <Input label="Customer name" required value={f.name} onChange={set('name')} />
              <Input label="Address line 1" required value={f.address_1} onChange={set('address_1')} />
              <Input label="Address line 2" value={f.address_2} onChange={set('address_2')} />
            </>
          )}
          {f.action === 'change_phone' && <Input label="New phone number" required value={f.phone} onChange={set('phone')} />}
        </form>
      </Modal>
    </div>
  );
}
