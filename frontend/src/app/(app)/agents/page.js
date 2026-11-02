'use client';

import ResourcePage from '@/components/common/ResourcePage';
import RoleGuard from '@/components/layout/RoleGuard';
import { agentsConfig } from '@/config/resources/users';

export default function AgentsPage() {
  return (
    <RoleGuard roles={['admin']}>
      <ResourcePage config={agentsConfig} />
    </RoleGuard>
  );
}
