'use client';

import { useState } from 'react';
import { AlertTriangle, Boxes, PackageCheck } from 'lucide-react';
import useList from '@/hooks/useList';
import useFetch from '@/hooks/useFetch';
import RoleGuard from '@/components/layout/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Tabs from '@/components/ui/Tabs';
import StatCard from '@/components/ui/StatCard';
import Pagination from '@/components/ui/Pagination';
import FilterBar from '@/components/common/FilterBar';
import StockTable from '@/components/inventory/StockTable';
import MovementsTable from '@/components/inventory/MovementsTable';
import AdjustStockModal from '@/components/inventory/AdjustStockModal';

const TABS = [
  { value: 'stock', label: 'Stock levels' },
  { value: 'low', label: 'Low stock alerts' },
  { value: 'history', label: 'Stock history' },
];

export default function InventoryPage() {
  const [tab, setTab] = useState('stock');
  const [adjusting, setAdjusting] = useState(null);
  const list = useList('/products', {}, 15);
  const low = useFetch('/products/low-stock');

  const refresh = () => { list.reload(); low.reload(); setAdjusting(null); };
  const totalUnits = list.rows.reduce((s, p) => s + p.stock, 0);

  return (
    <RoleGuard roles={['admin']}>
      <PageHeader title="Inventory" description="Live stock. Orders reserve stock and cancellations return it automatically." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Products tracked" value={list.meta.total} icon={Boxes} />
        <StatCard label="Units on this page" value={totalUnits} icon={PackageCheck} tone="success" />
        <StatCard label="Needs restock" value={low.data?.length ?? 0} icon={AlertTriangle} tone="warning" />
      </div>

      <Card padded={false}>
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
        {tab === 'stock' && (
          <>
            <FilterBar params={list.params} setParam={list.setParam} searchPlaceholder="Search by product or SKU" />
            <StockTable rows={list.rows} loading={list.loading} onAdjust={setAdjusting} />
            <Pagination meta={list.meta} onChange={list.setPage} />
          </>
        )}
        {tab === 'low' && <StockTable rows={low.data || []} loading={low.loading} onAdjust={setAdjusting} />}
        {tab === 'history' && <MovementsTable />}
      </Card>
      <AdjustStockModal product={adjusting} onClose={() => setAdjusting(null)} onSaved={refresh} />
    </RoleGuard>
  );
}
