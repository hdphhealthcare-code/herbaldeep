'use client';

import RoleGuard from '@/components/layout/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import WarehousesTab from '@/components/shipping/WarehousesTab';

export default function Page() {
  return (
    <RoleGuard roles={['admin']}>
      <PageHeader title="Warehouses" description="Pickup locations used for shipping." />
      <Card padded={false}><WarehousesTab /></Card>
    </RoleGuard>
  );
}
