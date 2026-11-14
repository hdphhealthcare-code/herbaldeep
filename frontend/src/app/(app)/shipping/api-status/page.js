'use client';

import RoleGuard from '@/components/layout/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import ApiStatusTab from '@/components/shipping/ApiStatusTab';

export default function Page() {
  return (
    <RoleGuard roles={['admin']}>
      <PageHeader title="Courier API status" description="Connection check for every courier." />
      <Card padded={false}><ApiStatusTab /></Card>
    </RoleGuard>
  );
}
