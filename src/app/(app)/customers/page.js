'use client';

import ResourcePage from '@/components/common/ResourcePage';
import RoleGuard from '@/components/layout/RoleGuard';
import { customersConfig } from '@/config/resources/customers';

export default function CustomersPage() {
  return (
    <RoleGuard roles={['admin']}>
      <ResourcePage config={customersConfig} />
    </RoleGuard>
  );
}
