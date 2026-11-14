'use client';

import { useState } from 'react';
import { ClipboardList, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import useList from '@/hooks/useList';
import Button from '@/components/ui/Button';
import DataTable from '@/components/ui/DataTable';
import Pagination from '@/components/ui/Pagination';
import LiveBadge from '@/components/common/LiveBadge';
import LabelModal from './LabelModal';
import { PROVIDER_LABEL } from '@/lib/shipping';
import { formatDate } from '@/lib/format';

// Booked parcels still waiting for the courier to pick them up: print labels, make the pickup manifest
export default function PickupsTab() {
  const list = useList('/orders', { status: 'ready_for_dispatch' }, 15, { refreshMs: 20000 });
  const [labelOrder, setLabelOrder] = useState(null);
  const [busy, setBusy] = useState('');

  const manifest = async (row) => {
    setBusy(row._id);
    try {
      const res = await api.post(`/shipping/orders/${row._id}/manifest`);
      toast.success(row.shipping?.provider === 'delhivery' ? 'Pickup requested' : 'Manifest generated');
      if (res.result?.manifest) window.open(res.result.manifest, '_blank');
      list.reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  };

  const columns = [
    { key: 'orderId', label: 'Order', render: (r) => <div><p className="font-semibold text-primary">{r.orderId}</p><p className="text-xs text-muted">{formatDate(r.orderDate)}</p></div> },
    { key: 'customer', label: 'Deliver to', render: (r) => <div><p className="font-medium">{r.customer?.name}</p><p className="text-xs text-muted">{[r.customer?.city, r.customer?.pincode].filter(Boolean).join(' - ')}</p></div> },
    { key: 'courier', label: 'Courier', render: (r) => r.shipping?.courierName || PROVIDER_LABEL[r.shipping?.provider || 'xpressbees'] },
    { key: 'awb', label: 'AWB', render: (r) => r.shipping?.awb || <span className="text-xs text-muted">Pending</span> },
    { key: 'pickup', label: 'Pickup from', render: (r) => r.warehouse?.title || '-' },
    {
      key: 'actions', label: '',
      render: (r) => (
        <div className="flex gap-1.5">
          {r.shipping?.awb && <Button size="sm" variant="secondary" icon={FileText} onClick={() => setLabelOrder(r)}>Label</Button>}
          {r.shipping?.awb && r.shipping?.provider !== 'shipmozo' && (
            <Button size="sm" variant="secondary" icon={ClipboardList} loading={busy === r._id} onClick={() => manifest(r)}>{r.shipping?.provider === 'delhivery' ? 'Request pickup' : 'Manifest'}</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <p className="text-sm text-muted">Orders that are booked and ready for the courier to collect. Once picked up they leave this list by themselves.</p>
        <LiveBadge updatedAt={list.updatedAt} />
      </div>
      <DataTable columns={columns} rows={list.rows} loading={list.loading} emptyTitle="Nothing waiting for pickup" emptyDescription="Booked parcels appear here until the courier collects them." />
      <Pagination meta={list.meta} onChange={list.setPage} />
      <LabelModal open={Boolean(labelOrder)} order={labelOrder} onClose={() => setLabelOrder(null)} />
    </div>
  );
}
