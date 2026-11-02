'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/FormField';

// Pincode serviceability for every connected courier. A route can work with one courier and not the other.
export default function ServiceabilityTab() {
  const [f, setF] = useState({ origin: '', destination: '' });
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setResults(null);
    try {
      setResults(await api.post('/shipping/serviceability', f));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-md space-y-4 p-5">
      <Input label="Pickup pincode" required maxLength={6} value={f.origin} onChange={(e) => setF({ ...f, origin: e.target.value })} />
      <Input label="Delivery pincode" required maxLength={6} value={f.destination} onChange={(e) => setF({ ...f, destination: e.target.value })} />
      <Button type="submit" loading={busy}>Check serviceability</Button>
      {results && (
        <ul className="space-y-2">
          {results.map((r) => (
            <li key={r.provider} className="flex items-start gap-2 text-sm">
              {r.serviceable ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> : <XCircle className="mt-0.5 h-4 w-4 text-danger" />}
              <span>
                <span className="font-medium">{r.label}: </span>
                {r.error ? <span className="text-danger">{r.error}</span>
                  : r.serviceable ? `Serviceable${r.couriers ? `, ${r.couriers} courier option(s)` : ''}` : 'Not serviceable'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
