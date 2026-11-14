'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calculator, ChevronDown, LogOut, X, MapPinned, Menu as MenuIcon, PackagePlus, Search, Warehouse, Zap } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { humanize } from '@/lib/format';
import Menu, { MenuDivider, MenuItem, MenuLabel } from '@/components/ui/Menu';

export default function Topbar({ onMenu }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const urlSearch = useSearchParams().get('search') || '';
  const [q, setQ] = useState(urlSearch);
  useEffect(() => { setQ(urlSearch); }, [urlSearch]); // clearing the filter on the orders page clears the box too
  const admin = ['admin', 'super_admin'].includes(user?.role);

  const search = (e) => {
    e.preventDefault();
    const text = q.trim();
    router.push(text ? `/orders?search=${encodeURIComponent(text)}` : '/orders');
  };

  return (
    <header className="sticky top-0 z-20 flex h-[72px] items-center gap-4 border-b border-border bg-surface/90 px-4 backdrop-blur lg:px-8">
      <button className="rounded-lg p-2 text-muted hover:bg-surface-muted lg:hidden" onClick={onMenu} aria-label="Open menu"><MenuIcon className="h-5 w-5" /></button>

      {['admin', 'agent', 'ndr', 'super_admin'].includes(user?.role) && (
        <form onSubmit={search} role="search" className="relative hidden max-w-xl flex-1 sm:block">
          <button type="submit" aria-label="Search orders" className="absolute left-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition hover:bg-primary-soft hover:text-primary">
            <Search className="h-4 w-4" />
          </button>
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search orders, AWB, customer..." aria-label="Search orders"
            className="w-full rounded-xl border border-border bg-surface-muted py-2.5 pl-11 pr-10 text-sm placeholder:text-muted/70 focus:border-primary focus:bg-surface"
          />
          {q && (
            <button type="button" aria-label="Clear search" onClick={() => { setQ(''); if (urlSearch) router.push('/orders'); }}
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-border/60">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </form>
      )}

      <div className="ml-auto flex items-center gap-2">
        {admin && (
          <Menu width={232} trigger={(p) => (
            <button {...p} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground transition hover:bg-surface-muted">
              <Zap className="h-4 w-4 text-primary" /> <span className="hidden sm:inline">Quick actions</span>
            </button>
          )}>
            {(close) => (
              <>
                <MenuLabel>Create</MenuLabel>
                <MenuItem close={close} href="/orders/new" icon={PackagePlus}>Create order</MenuItem>
                <MenuItem close={close} href="/shipping/warehouses" icon={Warehouse}>Add warehouse</MenuItem>
                <MenuDivider />
                <MenuLabel>Check</MenuLabel>
                <MenuItem close={close} href="/shipping/rate-calculator" icon={Calculator}>Rate calculator</MenuItem>
                <MenuItem close={close} href="/shipping/serviceability" icon={MapPinned}>Pincode serviceability</MenuItem>
              </>
            )}
          </Menu>
        )}
        <span className="mx-1 hidden h-8 w-px bg-border sm:block" />
        <Menu width={220} trigger={(p) => (
          <button {...p} className="flex items-center gap-3 rounded-xl py-1.5 pl-1.5 pr-3 transition hover:bg-surface-muted">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">{user?.name?.[0]?.toUpperCase()}</span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-sm font-semibold">{user?.name}</span>
              <span className="block text-xs text-muted">{humanize(user?.role)}</span>
            </span>
            <ChevronDown className="h-4 w-4 text-muted" />
          </button>
        )}>
          {(close) => (<MenuItem close={close} icon={LogOut} danger onClick={logout}>Log out</MenuItem>)}
        </Menu>
      </div>
    </header>
  );
}
