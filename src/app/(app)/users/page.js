'use client';

import ResourcePage from '@/components/common/ResourcePage';
import RoleGuard from '@/components/layout/RoleGuard';
import { usersConfig } from '@/config/resources/users';

export default function UsersPage() {
  return (
    <RoleGuard roles={[]}>
      <ResourcePage config={usersConfig} />
    </RoleGuard>
  );
}
