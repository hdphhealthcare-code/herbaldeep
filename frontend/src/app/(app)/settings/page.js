'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { humanize } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/FormField';

export default function SettingsPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put('/auth/change-password', form);
      toast.success('Password updated');
      setForm({ currentPassword: '', newPassword: '' });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Settings" description="Your account and password." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Profile">
          <dl className="space-y-3 text-sm">
            {[['Name', user.name], ['Email', user.email], ['Role', humanize(user.role)]].map(([k, v]) => (
              <div key={k} className="flex justify-between"><dt className="text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>
            ))}
          </dl>
        </Card>
        <Card title="Change password">
          <form onSubmit={submit} className="space-y-4">
            <Input label="Current password" type="password" required value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
            <Input label="New password" type="password" required minLength={6} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
            <Button type="submit" loading={busy}>Update password</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
