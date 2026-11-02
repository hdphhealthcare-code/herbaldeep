'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Select, Input } from '@/components/ui/FormField';
import Button from '@/components/ui/Button';
import { currency } from '@/lib/format';

// items: [{ product, quantity }]; products: options with raw product
export default function OrderItemsEditor({ items, onChange, products }) {
  const update = (i, patch) => onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const priceOf = (id) => products.find((p) => p.value === id)?.raw.price || 0;
  const total = items.reduce((s, it) => s + priceOf(it.product) * Number(it.quantity || 0), 0);

  return (
    <div className="space-y-3">
      {items.map((it, i) => {
        const selected = products.find((p) => p.value === it.product)?.raw;
        return (
          <div key={i} className="grid items-end gap-3 sm:grid-cols-[1fr_120px_120px_40px]">
            <Select
              label={i === 0 ? 'Product' : undefined}
              placeholder="Select product"
              required
              value={it.product}
              options={products.map((p) => ({ value: p.value, label: `${p.label} (${p.raw.stock} in stock)` }))}
              onChange={(e) => update(i, { product: e.target.value })}
            />
            <Input
              label={i === 0 ? 'Quantity' : undefined}
              type="number" min="1" max={selected?.stock} required
              value={it.quantity}
              onChange={(e) => update(i, { quantity: e.target.value })}
            />
            <p className="pb-2 text-sm font-medium">{currency(priceOf(it.product) * Number(it.quantity || 0))}</p>
            <Button
              type="button" variant="ghost" size="sm" icon={Trash2} aria-label="Remove item"
              disabled={items.length === 1}
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            />
          </div>
        );
      })}
      <div className="flex items-center justify-between border-t border-border pt-3">
        <Button type="button" variant="soft" size="sm" icon={Plus} onClick={() => onChange([...items, { product: '', quantity: 1 }])}>
          Add product
        </Button>
        <p className="text-sm">Order total: <span className="text-base font-semibold">{currency(total)}</span></p>
      </div>
    </div>
  );
}
