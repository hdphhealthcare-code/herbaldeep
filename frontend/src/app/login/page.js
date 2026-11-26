'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/FormField';
import BrandLogo from '@/components/common/BrandLogo';
import { BRAND } from '@/lib/brand';

export default function LoginPage() {
  const { user, login } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) router.replace('/dashboard');
  }, [user, router]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(form.email, form.password);
      router.replace('/dashboard');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <BrandLogo dark size={44} />
        <div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white">
            Create, ship and track every order in one place.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed">Compare Xpressbees, Shipmozo, Ekart, Delhivery and Shiprocket rates, print labels, and watch each parcel move live until it is delivered.</p>
        </div>
        <p className="text-xs">&copy; {new Date().getFullYear()} {BRAND.company}</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-surface p-8 shadow-card">
          <div>
            <div className="mb-5 lg:hidden"><BrandLogo /></div>
            <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="mt-1 text-sm text-muted">Sign in with the email and password given by your admin.</p>
          </div>
          <Input label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Password" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Button type="submit" loading={busy} className="w-full">Sign in</Button>
        </form>
      </div>
    </div>
  );
}
