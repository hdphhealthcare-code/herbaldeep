'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import useWarehouses from '@/hooks/useWarehouses';
import Button from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/FormField';
import PincodeHint from './PincodeHint';

// Pincode serviceability for every connected courier. A route can work with one courier and not the other.
export default function ServiceabilityTab() {
  const wh = useWarehouses();
  const [f, setF] = useState({ origin: '', destination: '' });
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const pin = (k) => (e) => setF({ ...f, [k]: e.target.value.replace(/\D/g, '').slice(0, 6) });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setResults(null);
    try {
      setResults(await api.post('/shipping/serviceability', { ...f, origin: f.origin || undefined })); // empty pickup = default warehouse
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-md space-y-4 p-5">
      <Select label="Pickup warehouse" placeholder="Default warehouse" options={wh.options}
        value={wh.rows.find((w) => w.pincode === f.origin)?._id || ''}
        onChange={(e) => setF({ ...f, origin: wh.rows.find((w) => String(w._id) === e.target.value)?.pincode || '' })} />
      <Input label="Pickup pincode (optional)" inputMode="numeric" maxLength={6} value={f.origin} onChange={pin('origin')}
        hint={f.origin ? <PincodeHint pincode={f.origin} /> : 'Leave empty to use the default pickup warehouse'} />
      <Input label="Delivery pincode" required inputMode="numeric" maxLength={6} value={f.destination} onChange={pin('destination')} hint={<PincodeHint pincode={f.destination} />} />
      <Button type="submit" loading={busy}>Check serviceability</Button>
      {results && (
        <ul className="space-y-2">
          {results.map((r) => (
            <li key={r.provider} className="flex items-start gap-2 text-sm">
              {r.serviceable ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> : <XCircle className="mt-0.5 h-4 w-4 text-danger" />}
              <span>
                <span className="font-medium">{r.label}: </span>
                {r.error ? <span className="text-danger">{r.error}</span>
                  : r.serviceable ? `Serviceable${r.couriers ? `, ${r.couriers} courier option(s)` : ''}` : `Not serviceable${r.note ? ` (${r.note.replace(/^Delhivery: /, '')})` : ''}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
