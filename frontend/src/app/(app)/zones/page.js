'use client';

import ResourcePage from '@/components/common/ResourcePage';
import RoleGuard from '@/components/layout/RoleGuard';
import { zonesConfig } from '@/config/resources/zones';

export default function ZonesPage() {
  return (
    <RoleGuard roles={['admin']}>
      <ResourcePage config={zonesConfig} />
    </RoleGuard>
  );
}
