'use client';

import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import useFetch from '@/hooks/useFetch';
import RoleGuard from '@/components/layout/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import Spinner from '@/components/ui/Spinner';
import StatusBadge from '@/components/common/StatusBadge';
import OrderSummary from '@/components/orders/OrderSummary';
import AssignAgentPanel from '@/components/orders/AssignAgentPanel';
import CourierPanel from '@/components/orders/CourierPanel';
import StatusUpdater from '@/components/orders/StatusUpdater';
import StatusTimeline from '@/components/orders/StatusTimeline';
import ShippingPanel from '@/components/shipping/ShippingPanel';
import OrderHeaderActions from '@/components/orders/OrderHeaderActions';
import { formatDate } from '@/lib/format';

export default function OrderDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const isAgent = user.role === 'agent';
  const { data: order, loading, error, setData } = useFetch(`/orders/${id}`);
  const { data: invoices } = useFetch(isAgent ? null : '/invoices', { order: id });

  if (loading) return <Spinner />;
  if (error || !order) return <p className="text-sm text-danger">{error || 'Order not found'}</p>;
  const invoice = invoices?.data?.find((i) => i.order?._id === order._id);

  return (
    <RoleGuard roles={['admin', 'agent']}>
      <PageHeader
        title={`Order ${order.orderId}`}
        description={`Placed on ${formatDate(order.orderDate)}`}
        actions={(
          <>
            <StatusBadge value={order.status} />
            {!isAgent && <OrderHeaderActions order={order} invoice={invoice} />}
          </>
        )}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <OrderSummary order={order} />
          {!isAgent && <ShippingPanel order={order} onUpdated={setData} />}
          {!isAgent && <CourierPanel key={order.updatedAt} order={order} onUpdated={setData} />}
        </div>
        <div className="space-y-6">
          <StatusUpdater order={order} isAgent={isAgent} onUpdated={setData} />
          {!isAgent && <AssignAgentPanel key={order.updatedAt} order={order} onUpdated={setData} />}
          <StatusTimeline history={order.statusHistory} />
        </div>
      </div>
    </RoleGuard>
  );
}
