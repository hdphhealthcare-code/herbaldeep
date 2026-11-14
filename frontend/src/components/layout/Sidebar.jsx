'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronsLeft, ChevronsRight, X } from 'lucide-react';
import { NAV_SECTIONS, canSee } from '@/lib/navigation';
import { useAuth } from '@/context/AuthContext';
import BrandLogo from '@/components/common/BrandLogo';

// Dark sidebar. On desktop it can shrink to an icon rail (names show as a tooltip).
export default function Sidebar({ open, onClose, collapsed, onToggle }) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-overlay/60 backdrop-blur-sm lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col bg-sidebar text-sidebar-foreground transition-all duration-200 lg:translate-x-0 ${
          collapsed ? 'lg:w-[76px]' : 'lg:w-[264px]'} ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className={`flex h-[72px] items-center border-b border-white/5 ${collapsed ? 'justify-center px-0' : 'justify-between px-5'}`}>
          <Link href="/dashboard" onClick={onClose}><BrandLogo dark compact={collapsed} /></Link>
          <button className="text-sidebar-foreground lg:hidden" onClick={onClose} aria-label="Close menu"><X className="h-5 w-5" /></button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {NAV_SECTIONS.map((section) => {
            const items = section.items.filter((i) => canSee(i, user?.role));
            if (!items.length) return null;
            return (
              <div key={section.title}>
                {collapsed
                  ? <div className="mx-3 mb-2 hidden h-px bg-white/10 lg:block" />
                  : <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/35">{section.title}</p>}
                {items.map((item) => {
                  // "Orders" must not stay highlighted on /orders/new, and /orders/<id> still counts as Orders
                  const active = pathname === item.href
                    || (!item.exact && pathname.startsWith(`${item.href}/`))
                    || (item.exact && pathname.startsWith(`${item.href}/`) && !pathname.startsWith(`${item.href}/new`) && !pathname.startsWith(`${item.href}/bulk`));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      title={collapsed ? item.label : undefined}
                      className={`group relative mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${collapsed ? 'lg:justify-center' : ''} ${
                        active ? 'bg-white/10 font-semibold text-white' : 'hover:bg-white/5 hover:text-white'}`}
                    >
                      {active && <span className="absolute -left-3 top-2 h-[calc(100%-1rem)] w-1 rounded-r-full bg-primary" />}
                      <item.icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-primary' : ''}`} />
                      <span className={collapsed ? 'lg:hidden' : ''}>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <button onClick={onToggle} className="hidden items-center gap-3 border-t border-white/5 px-6 py-4 text-xs text-white/40 transition hover:text-white lg:flex">
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Collapse menu</>}
        </button>
      </aside>
    </>
  );
}
