'use client';

import ResourcePage from '@/components/common/ResourcePage';
import RoleGuard from '@/components/layout/RoleGuard';
import { useAuth } from '@/context/AuthContext';
import { customersConfig } from '@/config/resources/customers';

// Admin: every customer. Agent: the customers they added (the API limits it), they can add and edit but not delete.
export default function CustomersPage() {
  const { user } = useAuth();
  const agent = user.role === 'agent';
  const config = agent
    ? {
      ...customersConfig,
      title: 'My customers',
      description: 'Customers you added. Pick them again when you create an order. Enter the pincode and the state and city fill in by themselves.',
      canDelete: false,
      columns: customersConfig.columns.filter((c) => c.key !== 'createdBy'),
    }
    : customersConfig;
  return (
    <RoleGuard roles={['admin', 'agent']}>
      <ResourcePage config={config} />
    </RoleGuard>
  );
}
