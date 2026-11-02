'use client';

import { LogOut, Menu } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { humanize } from '@/lib/format';
import Button from '@/components/ui/Button';

export default function Topbar({ onMenu }) {
  const { user, logout } = useAuth();
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-surface px-4 lg:px-8">
      <button className="rounded-md p-2 text-muted hover:bg-surface-muted lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>
      <div className="hidden text-sm text-muted lg:block">Healthcare Order, Courier, Invoice & HR CRM</div>
      <div className="flex items-center gap-3">
        <div className="text-right leading-tight">
          <p className="text-sm font-medium">{user?.name}</p>
          <p className="text-xs text-muted">{humanize(user?.role)}</p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
          {user?.name?.[0]?.toUpperCase()}
        </span>
        <Button variant="ghost" size="sm" icon={LogOut} onClick={logout}>Logout</Button>
      </div>
    </header>
  );
}
