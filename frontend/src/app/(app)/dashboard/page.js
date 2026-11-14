'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  PackageSearch, PackagePlus, Clock, UserCheck, Truck, CheckCircle2, FileText, FileClock, FileCheck2,
  IndianRupee, Users, UserX, CalendarOff, Boxes, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import usePolling from '@/hooks/usePolling';
import { currency } from '@/lib/format';
import PageHeader from '@/components/ui/PageHeader';
import LiveBadge from '@/components/common/LiveBadge';
import Spinner from '@/components/ui/Spinner';
import StatGroup from '@/components/dashboard/StatGroup';
import BarList from '@/components/dashboard/BarList';
import StatusBreakdown from '@/components/dashboard/StatusBreakdown';

const orderStats = (o) => [
  { label: 'Total orders', value: o.total, icon: PackageSearch },
  { label: 'Pending confirmation', value: o.toConfirm ?? o.new + o.assigned, icon: PackagePlus, tone: 'info' },
  { label: 'Confirmed (to ship)', value: o.confirmed ?? 0, icon: UserCheck, tone: 'success' },
  { label: 'Ready for dispatch', value: o.ready, icon: Clock, tone: 'warning' },
  { label: 'In transit', value: o.inTransit, icon: Truck, tone: 'warning' },
  { label: 'Delivery failed (NDR)', value: o.ndr, icon: AlertTriangle, tone: 'danger' },
  { label: 'Delivered / completed', value: o.completed, icon: CheckCircle2, tone: 'success' },
  { label: 'RTO', value: o.rto, icon: UserCheck, tone: 'danger' },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const loading = !data && !error;

  const load = useCallback(() => api.get('/dashboard')
    .then((d) => { setData(d); setError(''); setUpdatedAt(new Date()); })
    .catch((e) => setError((prev) => prev || e.message)), []);
  useEffect(() => { load(); }, [load]);
  usePolling(load, 30000); // numbers follow the live courier status

  if (loading) return <Spinner />;
  if (error) return <p className="text-sm text-danger">{error}</p>;

  return (
    <>
      <PageHeader title={`Welcome, ${user.name.split(' ')[0]}`} description="Order status updates live from the couriers." actions={<LiveBadge updatedAt={updatedAt} />} />

      {data.orders && <StatGroup title={user.role === 'agent' ? 'My orders' : 'Orders'} stats={orderStats(data.orders)} />}

      {data.invoices && (
        <StatGroup title="Invoices & stock" stats={[
          { label: 'Total invoices', value: data.invoices.total, icon: FileText },
          { label: 'Pending invoices', value: data.invoices.pending, icon: FileClock, tone: 'warning' },
          { label: 'Paid invoices', value: data.invoices.paid, icon: FileCheck2, tone: 'success' },
          { label: 'Revenue collected', value: currency(data.invoices.revenue), icon: IndianRupee, tone: 'success' },
          { label: 'Products tracked', value: data.inventory.products, icon: Boxes },
          { label: 'Units in stock', value: data.inventory.units, icon: Boxes, tone: 'info' },
          { label: 'Low-stock items', value: data.inventory.lowStock, icon: AlertTriangle, tone: 'danger' },
        ]} />
      )}

      {data.hr && (
        <StatGroup title="Employees today" stats={[
          { label: 'Total employees', value: data.hr.total, icon: Users },
          { label: 'Present', value: data.hr.present, icon: UserCheck, tone: 'success' },
          { label: 'Absent', value: data.hr.absent, icon: UserX, tone: 'danger' },
          { label: 'On leave / half day', value: data.hr.leave + data.hr.halfDay, icon: CalendarOff, tone: 'warning' },
        ]} />
      )}

      {data.agentWise && (
        <div className="grid gap-6 lg:grid-cols-2">
          <StatusBreakdown byStatus={data.orders.byStatus} />
          <BarList title="Agent-wise orders" rows={data.agentWise} />
        </div>
      )}
    </>
  );
}
