'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import useList from '@/hooks/useList';
import { INVOICE_STATUS } from '@/lib/constants';
import { currency, formatDate } from '@/lib/format';
import RoleGuard from '@/components/layout/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import DataTable from '@/components/ui/DataTable';
import Pagination from '@/components/ui/Pagination';
import FilterBar from '@/components/common/FilterBar';
import StatusBadge from '@/components/common/StatusBadge';

export default function InvoicesPage() {
  const router = useRouter();
  const list = useList('/invoices', { status: '' });
  const columns = [
    { key: 'invoiceNo', label: 'Invoice no.', render: (r) => <span className="font-medium text-primary">{r.invoiceNo}</span> },
    { key: 'invoiceDate', label: 'Date', render: (r) => formatDate(r.invoiceDate) },
    { key: 'customer', label: 'Customer', render: (r) => r.customer?.name },
    { key: 'order', label: 'Order', render: (r) => r.order?.orderId || '-' },
    { key: 'grandTotal', label: 'Total', render: (r) => currency(r.grandTotal) },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge type="invoice" value={r.status} /> },
  ];

  return (
    <RoleGuard roles={['admin']}>
      <PageHeader
        title="Invoices" description="Invoices raised against completed orders."
        actions={<Link href="/invoices/new"><Button icon={Plus}>New invoice</Button></Link>}
      />
      <Card padded={false}>
        <FilterBar
          params={list.params} setParam={list.setParam} dates searchPlaceholder="Search by invoice no., customer or mobile"
          filters={[{ key: 'status', placeholder: 'All status', options: INVOICE_STATUS }]}
        />
        <DataTable columns={columns} rows={list.rows} loading={list.loading} onRowClick={(r) => router.push(`/invoices/${r._id}`)} emptyTitle="No invoices yet" />
        <Pagination meta={list.meta} onChange={list.setPage} />
      </Card>
    </RoleGuard>
  );
}
