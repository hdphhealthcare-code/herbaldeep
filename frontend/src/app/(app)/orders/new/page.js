'use client';

import RoleGuard from '@/components/layout/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import OrderForm from '@/components/orders/OrderForm';

export default function NewOrderPage() {
  return (
    <RoleGuard roles={['admin']}>
      <PageHeader title="Create order" description="Customer, products and zone in one go. Stock is reserved automatically." />
      <OrderForm />
    </RoleGuard>
  );
}
