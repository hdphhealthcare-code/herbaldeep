'use client';

import { Suspense } from 'react';
import RoleGuard from '@/components/layout/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import Spinner from '@/components/ui/Spinner';
import InvoiceForm from '@/components/invoice/InvoiceForm';

export default function NewInvoicePage() {
  return (
    <RoleGuard roles={['admin']}>
      <PageHeader title="New invoice" description="Pick an order to fill in the items automatically, or add them by hand." />
      <Suspense fallback={<Spinner />}>
        <InvoiceForm />
      </Suspense>
    </RoleGuard>
  );
}
