'use client';

import ResourcePage from '@/components/common/ResourcePage';
import RoleGuard from '@/components/layout/RoleGuard';
import { productsConfig } from '@/config/resources/products';

export default function ProductsPage() {
  return (
    <RoleGuard roles={['admin']}>
      <ResourcePage config={productsConfig} />
    </RoleGuard>
  );
}
