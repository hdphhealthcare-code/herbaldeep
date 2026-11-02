'use client';

import {
  PackageSearch, PackagePlus, Clock, UserCheck, Truck, CheckCircle2, FileText, FileClock, FileCheck2,
  IndianRupee, Users, UserX, CalendarOff, Boxes, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import useFetch from '@/hooks/useFetch';
import { currency } from '@/lib/format';
import PageHeader from '@/components/ui/PageHeader';
import Spinner from '@/components/ui/Spinner';
import StatGroup from '@/components/dashboard/StatGroup';
import BarList from '@/components/dashboard/BarList';
import StatusBreakdown from '@/components/dashboard/StatusBreakdown';

const orderStats = (o) => [
  { label: 'Total orders', value: o.total, icon: PackageSearch },
  { label: 'New orders', value: o.new, icon: PackagePlus, tone: 'info' },
  { label: 'Pending orders', value: o.pending, icon: Clock, tone: 'warning' },
  { label: 'Agent assigned', value: o.assigned, icon: UserCheck },
  { label: 'Dispatched', value: o.dispatched, icon: Truck, tone: 'warning' },
  { label: 'Delivered / completed', value: o.completed, icon: CheckCircle2, tone: 'success' },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, loading, error } = useFetch('/dashboard');

  if (loading) return <Spinner />;
  if (error) return <p className="text-sm text-danger">{error}</p>;

  return (
    <>
      <PageHeader title={`Welcome, ${user.name.split(' ')[0]}`} description="Here is what is happening today." />

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

      {data.zoneWise && (
        <div className="grid gap-6 lg:grid-cols-3">
          <StatusBreakdown byStatus={data.orders.byStatus} />
          <BarList title="Zone-wise orders" rows={data.zoneWise} />
          <BarList title="Agent-wise orders" rows={data.agentWise} />
        </div>
      )}
    </>
  );
}
