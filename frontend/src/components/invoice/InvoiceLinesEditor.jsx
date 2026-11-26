'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/FormField';
import Button from '@/components/ui/Button';
import { currency } from '@/lib/format';

export default function InvoiceLinesEditor({ lines, onChange }) {
  const update = (i, patch) => onChange(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  return (
    <div className="space-y-3">
      {lines.map((l, i) => (
        <div key={i} className="grid items-end gap-3 sm:grid-cols-[1fr_90px_120px_110px_40px]">
          <Input label={i === 0 ? 'Product / service' : undefined} required value={l.name} onChange={(e) => update(i, { name: e.target.value })} />
          <Input label={i === 0 ? 'Qty' : undefined} type="number" min="1" required value={l.quantity} onChange={(e) => update(i, { quantity: e.target.value })} />
          <Input label={i === 0 ? 'Rate' : undefined} type="number" min="0" step="any" required value={l.rate} onChange={(e) => update(i, { rate: e.target.value })} />
          <p className="pb-2 text-sm font-medium">{currency(Number(l.quantity || 0) * Number(l.rate || 0))}</p>
          <Button type="button" variant="ghost" size="sm" icon={Trash2} aria-label="Remove line" disabled={lines.length === 1}
            onClick={() => onChange(lines.filter((_, idx) => idx !== i))} />
        </div>
      ))}
      <Button type="button" variant="soft" size="sm" icon={Plus} onClick={() => onChange([...lines, { name: '', quantity: 1, rate: '' }])}>
        Add line
      </Button>
    </div>
  );
}
