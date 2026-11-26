'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Spinner from '@/components/ui/Spinner';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const KEY = 'herbaldeep_sidebar';

export default function AppShell({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(KEY) === '1'); } catch { /* private mode: stays expanded */ }
  }, []);
  const toggle = () => setCollapsed((c) => {
    try { localStorage.setItem(KEY, c ? '0' : '1'); } catch { /* ignore */ }
    return !c;
  });

  if (loading || !user) return <div className="min-h-screen"><Spinner /></div>;

  return (
    <div className="min-h-screen">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} collapsed={collapsed} onToggle={toggle} />
      <div className={`transition-all duration-200 ${collapsed ? 'lg:pl-[76px]' : 'lg:pl-[264px]'}`}>
        <Topbar onMenu={() => setMenuOpen(true)} />
        <main className="mx-auto max-w-[1500px] p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
