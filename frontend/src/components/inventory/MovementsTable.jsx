'use client';

import useList from '@/hooks/useList';
import DataTable from '@/components/ui/DataTable';
import Pagination from '@/components/ui/Pagination';
import Badge from '@/components/ui/Badge';
import { formatDateTime } from '@/lib/format';

const TONE = { in: 'success', return: 'info', out: 'warning', adjustment: 'danger' };

export default function MovementsTable() {
  const list = useList('/products/movements', {}, 15);
  const columns = [
    { key: 'createdAt', label: 'When', render: (r) => formatDateTime(r.createdAt) },
    { key: 'product', label: 'Product', render: (r) => <span className="font-medium">{r.product?.name}</span> },
    { key: 'type', label: 'Type', render: (r) => <Badge tone={TONE[r.type]}>{r.type}</Badge> },
    { key: 'quantity', label: 'Change', render: (r) => <span className={r.quantity > 0 ? 'text-success' : 'text-danger'}>{r.quantity > 0 ? `+${r.quantity}` : r.quantity}</span> },
    { key: 'balance', label: 'Balance' },
    { key: 'reason', label: 'Reason' },
    { key: 'createdBy', label: 'By', render: (r) => r.createdBy?.name || '-' },
  ];
  return (
    <>
      <DataTable columns={columns} rows={list.rows} loading={list.loading} emptyTitle="No stock movements yet" />
      <Pagination meta={list.meta} onChange={list.setPage} />
    </>
  );
}
