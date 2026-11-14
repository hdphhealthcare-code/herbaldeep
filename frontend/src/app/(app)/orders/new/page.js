'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import RoleGuard from '@/components/layout/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import Spinner from '@/components/ui/Spinner';
import useFetch from '@/hooks/useFetch';
import OrderWizard from '@/components/orders/OrderWizard';

function NewOrder() {
  const cloneId = useSearchParams().get('clone');
  const { data: source, loading, error } = useFetch(cloneId ? `/orders/${cloneId}` : null);
  if (cloneId && loading) return <Spinner />;
  if (cloneId && error) return <p className="text-sm text-danger">{error}</p>;
  return (
    <>
      <PageHeader
        title={cloneId ? `Clone order ${source?.orderId || ''}` : 'Create order'}
        description={cloneId ? 'Customer, products, package and payment are copied. Change anything, then create the new order.' : 'Step 1: order and customer. Step 2: products and package. Then ship it with a courier.'}
      />
      <OrderWizard mode={cloneId ? 'clone' : 'create'} order={source} />
    </>
  );
}

export default function NewOrderPage() {
  return (<RoleGuard roles={['admin', 'agent']}><Suspense fallback={<Spinner />}><NewOrder /></Suspense></RoleGuard>);
}
