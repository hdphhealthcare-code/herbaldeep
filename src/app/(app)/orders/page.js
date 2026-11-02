'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import useList from '@/hooks/useList';
import useOptions from '@/hooks/useOptions';
import { ORDER_STATUS } from '@/lib/constants';
import RoleGuard from '@/components/layout/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Tabs from '@/components/ui/Tabs';
import Pagination from '@/components/ui/Pagination';
import FilterBar from '@/components/common/FilterBar';
import OrdersTable from '@/components/orders/OrdersTable';

const TABS = [{ value: '', label: 'All orders' }, ...ORDER_STATUS.map((s) => ({ value: s.value, label: s.label }))];

export default function OrdersPage() {
  const { user } = useAuth();
  const isAgent = user.role === 'agent';
  const list = useList('/orders', { status: '' });
  const zones = useOptions(isAgent ? null : '/zones');
  const agents = useOptions(isAgent ? null : '/users', { role: 'agent' });

  const filters = isAgent ? [] : [
    { key: 'zone', placeholder: 'All zones', options: zones },
    { key: 'agent', placeholder: 'All agents', options: agents },
  ];

  return (
    <RoleGuard roles={['admin', 'agent']}>
      <PageHeader
        title={isAgent ? 'My orders' : 'Orders'}
        description={isAgent ? 'Orders assigned to you.' : 'Create, assign and track every order.'}
        actions={!isAgent && <Link href="/orders/new"><Button icon={Plus}>Create order</Button></Link>}
      />
      <Card padded={false}>
        <Tabs tabs={TABS} value={list.params.status} onChange={(v) => list.setParam('status', v)} />
        <FilterBar
          params={list.params} setParam={list.setParam} dates filters={filters}
          searchPlaceholder="Search by order ID, customer or mobile"
        />
        <OrdersTable rows={list.rows} loading={list.loading} />
        <Pagination meta={list.meta} onChange={list.setPage} />
      </Card>
    </RoleGuard>
  );
}
