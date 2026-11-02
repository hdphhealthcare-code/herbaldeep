'use client';

import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import EmptyState from '@/components/ui/EmptyState';

// Client-side guard for pages (the API enforces the same rules server-side).
export default function RoleGuard({ roles, children }) {
  const { user } = useAuth();
  if (user.role === 'super_admin' || roles.includes(user.role)) return children;
  return <EmptyState title="Access restricted" description="Your role does not have permission to view this page." action={<ShieldAlert className="h-5 w-5 text-danger" />} />;
}
