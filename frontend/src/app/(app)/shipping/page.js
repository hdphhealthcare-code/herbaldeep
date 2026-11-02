'use client';

import { useState } from 'react';
import RoleGuard from '@/components/layout/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Tabs from '@/components/ui/Tabs';
import WarehousesTab from '@/components/shipping/WarehousesTab';
import ServiceabilityTab from '@/components/shipping/ServiceabilityTab';
import RateCalculatorTab from '@/components/shipping/RateCalculatorTab';
import NdrTab from '@/components/shipping/NdrTab';
import ApiStatusTab from '@/components/shipping/ApiStatusTab';

const TABS = [
  { value: 'warehouses', label: 'Warehouses' },
  { value: 'rates', label: 'Rate calculator' },
  { value: 'serviceability', label: 'Pincode serviceability' },
  { value: 'ndr', label: 'NDR / Exceptions' },
  { value: 'api', label: 'API status' },
];

export default function ShippingPage() {
  const [tab, setTab] = useState('warehouses');
  return (
    <RoleGuard roles={['admin']}>
      <PageHeader title="Shipping" description="Courier tools for Xpressbees, Shipmozo and Ekart. Book and ship individual orders from the order page." />
      <Card padded={false}>
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
        {tab === 'warehouses' && <WarehousesTab />}
        {tab === 'rates' && <RateCalculatorTab />}
        {tab === 'serviceability' && <ServiceabilityTab />}
        {tab === 'ndr' && <NdrTab />}
        {tab === 'api' && <ApiStatusTab />}
      </Card>
    </RoleGuard>
  );
}
