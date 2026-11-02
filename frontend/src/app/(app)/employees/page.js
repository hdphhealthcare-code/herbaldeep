'use client';

import ResourcePage from '@/components/common/ResourcePage';
import RoleGuard from '@/components/layout/RoleGuard';
import { employeesConfig } from '@/config/resources/employees';

export default function EmployeesPage() {
  return (
    <RoleGuard roles={['hr']}>
      <ResourcePage config={employeesConfig} />
    </RoleGuard>
  );
}
