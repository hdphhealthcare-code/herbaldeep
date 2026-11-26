'use client';

import RoleGuard from '@/components/layout/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import NdrTab from '@/components/shipping/NdrTab';
import { useAuth } from '@/context/AuthContext';

export default function Page() {
  const { user } = useAuth();
  return (
    <RoleGuard roles={['admin', 'ndr', 'agent']}>
      <PageHeader title="NDR / Exceptions"
        description={user.role === 'agent'
          ? 'Your orders whose delivery failed. Ask the courier to re-attempt, on any courier platform.'
          : 'Failed deliveries from every courier platform (Xpressbees, Shipmozo, Ekart, Delhivery, Shiprocket). Act on one order or many at once.'} />
      <Card padded={false}><NdrTab /></Card>
    </RoleGuard>
  );
}
