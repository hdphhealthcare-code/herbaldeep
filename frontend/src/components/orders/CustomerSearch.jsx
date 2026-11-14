'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { api } from '@/lib/api';

// Search-as-you-type picker for existing customers (name, mobile, city or pincode). value = chosen customer or null.
export default function CustomerSearch({ value, onChange, mineOnly = false }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (value || !open) return undefined;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        setResults((await api.get('/customers', { search: q, limit: 8 })).data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, open, value]);

  if (value) {
    const missing = [!value.pincode && 'pincode', !value.state && 'state'].filter(Boolean);
    return (
      <div className="rounded-lg border border-border bg-surface-muted p-4 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">{value.name} <span className="font-normal text-muted">· {value.mobile}</span></p>
            <p className="mt-1 text-muted">{[value.address, value.area, value.city, value.state, value.pincode].filter(Boolean).join(', ')}</p>
          </div>
          <button type="button" onClick={() => onChange(null)} className="rounded-md p-1 text-muted hover:bg-surface" aria-label="Change customer">
            <X className="h-4 w-4" />
          </button>
        </div>
        {missing.length > 0 && (
          <p className="mt-3 rounded-lg bg-warning-soft p-2 text-xs text-warning">
            This customer has no {missing.join(' and ')}, so a courier cannot be booked. Add it in{' '}
            <Link href="/customers" className="font-medium underline">Customers</Link> first, or create a new customer.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <span className="mb-1 block text-sm font-medium">Customer <span className="text-danger">*</span></span>
      <Search className="pointer-events-none absolute left-3 top-[2.45rem] h-4 w-4 text-muted" />
      <input
        className="input-base pl-9" placeholder={mineOnly ? 'Search your customers by name, mobile, city or pincode' : 'Search by name, mobile, city or pincode'} value={q} autoComplete="off"
        onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-surface shadow-pop">
          {loading && <li className="px-3 py-2 text-sm text-muted">Searching...</li>}
          {!loading && !results.length && <li className="px-3 py-2 text-sm text-muted">{mineOnly ? 'None of your customers matches. Use "New customer" to add one.' : 'No customer found. Use "New customer".'}</li>}
          {results.map((c) => (
            <li key={c._id}>
              <button type="button" className="block w-full px-3 py-2 text-left hover:bg-surface-muted" onMouseDown={() => { onChange(c); setOpen(false); }}>
                <span className="block text-sm font-medium">{c.name} <span className="font-normal text-muted">· {c.mobile}</span></span>
                <span className="block text-xs text-muted">{[c.city, c.state, c.pincode].filter(Boolean).join(', ')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
