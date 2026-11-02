'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HeartPulse, X } from 'lucide-react';
import { NAV_SECTIONS, canSee } from '@/lib/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Sidebar({ open, onClose }) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-overlay/50 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/dashboard" className="flex items-center gap-2 text-sidebar-active">
            <span className="rounded-lg bg-primary p-1.5 text-primary-foreground"><HeartPulse className="h-5 w-5" /></span>
            <span className="text-base font-semibold">Fusse CRM</span>
          </Link>
          <button className="lg:hidden" onClick={onClose} aria-label="Close menu"><X className="h-5 w-5" /></button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6 pt-2">
          {NAV_SECTIONS.map((section) => {
            const items = section.items.filter((i) => canSee(i, user?.role));
            if (!items.length) return null;
            return (
              <div key={section.title}>
                <p className="mb-1 px-3 text-xs font-medium text-sidebar-foreground/60">{section.title}</p>
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                        active ? 'bg-primary text-primary-foreground' : 'hover:bg-sidebar-active/10 hover:text-sidebar-active'
                      }`}
                    >
                      <item.icon className="h-4 w-4" /> {item.label}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
