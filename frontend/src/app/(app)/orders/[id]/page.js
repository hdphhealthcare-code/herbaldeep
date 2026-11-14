'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import useFetch from '@/hooks/useFetch';
import usePolling from '@/hooks/usePolling';
import { FINAL_STATUS, isAdminRole } from '@/lib/constants';
import { formatDate } from '@/lib/format';
import RoleGuard from '@/components/layout/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import Spinner from '@/components/ui/Spinner';
import StatusBadge from '@/components/common/StatusBadge';
import OrderSummary from '@/components/orders/OrderSummary';
import AssignAgentPanel from '@/components/orders/AssignAgentPanel';
import OrderLiveStatus from '@/components/orders/OrderLiveStatus';
import StatusTimeline from '@/components/orders/StatusTimeline';
import ShippingPanel from '@/components/shipping/ShippingPanel';
import OrderHeaderActions from '@/components/orders/OrderHeaderActions';

const LIVE_MS = 30000;

export default function OrderDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const isAgent = user.role === 'agent';
  const admin = isAdminRole(user.role); // only an admin sees shipping, invoices and the agent panel
  const { data: loaded, loading, error } = useFetch(`/orders/${id}`);
  const { data: invoices } = useFetch(admin ? '/invoices' : null, { order: id });
  const [order, setOrder] = useState(null);
  const [track, setTrack] = useState(null); // latest courier scan list from the last live check
  const [updatedAt, setUpdatedAt] = useState(null);
  const busy = useRef(false);

  useEffect(() => {
    if (loaded) { setOrder(loaded); setUpdatedAt(new Date()); }
  }, [loaded]);

  const onUpdated = useCallback((o) => { setOrder(o); setUpdatedAt(new Date()); }, []);

  // Live refresh. For a shipment that is still moving, ask the courier directly; otherwise just reload the order.
  const refresh = useCallback(async () => {
    if (busy.current || !order) return;
    busy.current = true;
    try {
      const open = !isAgent && order.shipping?.status === 'booked' && !FINAL_STATUS.includes(order.status);
      if (open) {
        try {
          const res = await api.get(`/shipping/orders/${id}/track`);
          setOrder(res.order);
          setTrack(res.result);
        } catch {
          setOrder(await api.get(`/orders/${id}`)); // courier busy: still show what the server already knows
        }
      } else {
        setOrder(await api.get(`/orders/${id}`));
      }
      setUpdatedAt(new Date());
    } catch {
      /* keep the last good data; the next round tries again */
    } finally {
      busy.current = false;
    }
  }, [id, order, isAgent]);

  usePolling(refresh, LIVE_MS, Boolean(order) && !FINAL_STATUS.includes(order.status));

  if (loading && !order) return <Spinner />;
  if ((error && !order) || !order) return <p className="text-sm text-danger">{error || 'Order not found'}</p>;
  const invoice = invoices?.data?.find((i) => i.order?._id === order._id);

  return (
    <RoleGuard roles={['admin', 'agent', 'ndr']}>
      <PageHeader
        title={`Order ${order.orderId}`}
        description={`Placed on ${formatDate(order.orderDate)}`}
        actions={(
          <>
            <StatusBadge value={order.status} />
            <OrderHeaderActions order={order} invoice={invoice} role={user.role} onUpdated={onUpdated} />
          </>
        )}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <OrderSummary order={order} />
          {admin && <ShippingPanel order={order} track={track} onUpdated={onUpdated} onTrack={setTrack} />}
        </div>
        <div className="space-y-6">
          <OrderLiveStatus order={order} updatedAt={updatedAt} />
          {admin && <AssignAgentPanel order={order} onUpdated={onUpdated} />}
          {!admin && order.agent && (
            <div className="rounded-xl border border-border bg-surface p-5 text-sm shadow-card">
              <p className="text-xs text-muted">Assigned to</p><p className="font-semibold">{order.agent.name}</p>
            </div>
          )}
          <StatusTimeline history={order.statusHistory} />
        </div>
      </div>
    </RoleGuard>
  );
}
