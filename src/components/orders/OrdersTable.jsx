'use client';

import { useRouter } from 'next/navigation';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/common/StatusBadge';
import { currency, formatDate } from '@/lib/format';

export default function OrdersTable({ rows, loading }) {
  const router = useRouter();
  const columns = [
    { key: 'orderId', label: 'Order ID', render: (r) => <span className="font-medium text-primary">{r.orderId}</span> },
    { key: 'orderDate', label: 'Date', render: (r) => formatDate(r.orderDate) },
    {
      key: 'customer', label: 'Customer',
      render: (r) => (
        <div>
          <p className="font-medium">{r.customer?.name}</p>
          <p className="text-xs text-muted">{r.customer?.mobile}</p>
        </div>
      ),
    },
    { key: 'items', label: 'Items', render: (r) => r.items.reduce((s, i) => s + i.quantity, 0) },
    { key: 'totalAmount', label: 'Amount', render: (r) => currency(r.totalAmount) },
    { key: 'zone', label: 'Zone', render: (r) => r.zone?.name || '-' },
    { key: 'agent', label: 'Agent', render: (r) => r.agent?.name || '-' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
  ];
  return (
    <DataTable
      columns={columns} rows={rows} loading={loading}
      onRowClick={(r) => router.push(`/orders/${r._id}`)}
      emptyTitle="No orders found" emptyDescription="Orders matching this tab and filters will show up here."
    />
  );
}
