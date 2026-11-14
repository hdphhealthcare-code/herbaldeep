'use client';

import RoleGuard from '@/components/layout/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import RateCalculatorTab from '@/components/shipping/RateCalculatorTab';

export default function Page() {
  return (
    <RoleGuard roles={['admin']}>
      <PageHeader title="Rate calculator" description="Compare Xpressbees, Shipmozo, Ekart, Delhivery and Shiprocket prices for any route." />
      <Card padded={false}><RateCalculatorTab /></Card>
    </RoleGuard>
  );
}
