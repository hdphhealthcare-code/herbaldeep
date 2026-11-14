'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import RoleGuard from '@/components/layout/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import Spinner from '@/components/ui/Spinner';
import useFetch from '@/hooks/useFetch';
import { useAuth } from '@/context/AuthContext';
import { EDITABLE_STATUS, PRE_CONFIRM_STATUS, isAdminRole } from '@/lib/constants';
import OrderWizard from '@/components/orders/OrderWizard';

function EditOrder() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: order, loading, error } = useFetch(`/orders/${id}`);
  if (loading) return <Spinner />;
  if (error || !order) return <p className="text-sm text-danger">{error || 'Order not found'}</p>;
  const allowed = isAdminRole(user.role) ? EDITABLE_STATUS : PRE_CONFIRM_STATUS; // an agent edits only until the order is confirmed
  if (order.shipping?.status === 'booked' || !allowed.includes(order.status)) {
    return (
      <p className="rounded-2xl bg-surface p-6 text-sm">
        Order {order.orderId} cannot be edited any more (it is confirmed, shipped or finished).{' '}
        <Link className="font-medium text-primary underline" href={`/orders/${id}`}>Back to the order</Link>
      </p>
    );
  }
  return (
    <>
      <PageHeader title={`Edit order ${order.orderId}`} description="Change the customer, products, discount, package or payment. Stock is adjusted automatically." />
      <OrderWizard mode="edit" order={order} />
    </>
  );
}

export default function EditOrderPage() {
  return (<RoleGuard roles={['admin', 'agent']}><EditOrder /></RoleGuard>);
}
