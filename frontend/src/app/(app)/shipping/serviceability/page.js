'use client';

import RoleGuard from '@/components/layout/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import ServiceabilityTab from '@/components/shipping/ServiceabilityTab';

export default function Page() {
  return (
    <RoleGuard roles={['admin', 'agent', 'ndr']}>
      <PageHeader title="Pincode serviceability" description="Check which couriers deliver between a pickup and a delivery pincode." />
      <Card padded={false}><ServiceabilityTab /></Card>
    </RoleGuard>
  );
}
