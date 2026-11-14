'use client';

import RoleGuard from '@/components/layout/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import PickupsTab from '@/components/shipping/PickupsTab';

export default function Page() {
  return (
    <RoleGuard roles={['admin']}>
      <PageHeader title="Pickups & manifest" description="Parcels waiting for courier pickup: labels and pickup manifest." />
      <Card padded={false}><PickupsTab /></Card>
    </RoleGuard>
  );
}
