'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HeartPulse } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/FormField';

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
        <div className="flex items-center gap-2 text-sidebar-active">
          <span className="rounded-lg bg-primary p-2 text-primary-foreground"><HeartPulse className="h-6 w-6" /></span>
          <span className="text-xl font-semibold">Fusse CRM</span>
        </div>
        <div>
          <h1 className="text-3xl font-semibold leading-snug text-sidebar-active">
            Orders, couriers, invoices and attendance in one place.
          </h1>
          <p className="mt-3 max-w-md text-sm">Assign agents, track dispatches and keep stock in sync without switching tools.</p>
        </div>
        <p className="text-xs">Fusse Market Pvt. Ltd.</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-xl border border-border bg-surface p-8 shadow-card">
          <div>
            <h2 className="text-xl font-semibold">Sign in</h2>
            <p className="mt-1 text-sm text-muted">Use the email and password given by your admin.</p>
          </div>
          <Input label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Password" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Button type="submit" loading={busy} className="w-full">Sign in</Button>
        </form>
      </div>
    </div>
  );
}
