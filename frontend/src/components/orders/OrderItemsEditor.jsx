'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Select } from '@/components/ui/FormField';
import Button from '@/components/ui/Button';
import { currency } from '@/lib/format';
import { GST_RATE } from '@/lib/constants';
import { priceLines } from '@/lib/pricing';

/**
 * Product rows with a FLAT discount (rupees off that row, not a percentage). The price already includes the fixed 5% GST;
 * the row only shows how much of its total is GST.
 * items: [{ product, quantity, discount }]; products: options with raw product; keepPrices: product id -> price already on the order (edit)
 */
export default function OrderItemsEditor({ items, onChange, products, keepPrices = {} }) {
  const update = (i, patch) => onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const priceOf = (id) => keepPrices[id] ?? products.find((p) => p.value === id)?.raw.price ?? 0;
  const calc = priceLines(items.map((it) => ({ price: priceOf(it.product), quantity: it.quantity, discount: it.discount })));
  const cell = 'input-base num';

  return (
    <div className="space-y-3">
      <div className="hidden gap-3 px-1 sm:grid sm:grid-cols-[1fr_110px_90px_130px_140px_36px]">
        <span className="eyebrow">Product</span><span className="eyebrow">Price (incl. GST)</span><span className="eyebrow">Qty</span>
        <span className="eyebrow">Flat discount (Rs)</span><span className="eyebrow text-right">Total</span><span />
      </div>
      {items.map((it, i) => {
        const selected = products.find((p) => p.value === it.product)?.raw;
        const line = calc.lines[i];
        const over = selected && Number(it.quantity) > selected.stock;
        return (
          <div key={i} className="grid items-start gap-3 rounded-xl border border-border bg-surface-muted/50 p-3 sm:grid-cols-[1fr_110px_90px_130px_140px_36px] sm:border-0 sm:bg-transparent sm:p-0">
            <Select placeholder="Select product" required value={it.product} onChange={(e) => update(i, { product: e.target.value })}
              options={products.map((p) => ({ value: p.value, label: `${p.label} (${p.raw.stock} in stock)` }))} />
            <p className="num rounded-xl bg-surface-muted px-3 py-2.5 text-sm font-medium">{currency(priceOf(it.product))}</p>
            <div>
              <input className={cell} type="number" min="1" required value={it.quantity} aria-label="Quantity" onChange={(e) => update(i, { quantity: e.target.value })} />
              {over && <span className="mt-1 block text-[11px] text-danger">Only {selected.stock} in stock</span>}
            </div>
            <div>
              <input className={cell} type="number" min="0" step="0.01" placeholder="0" value={it.discount ?? ''} aria-label="Flat discount in rupees" onChange={(e) => update(i, { discount: e.target.value })} />
              {line?.tooMuch && <span className="mt-1 block text-[11px] text-danger">More than the item amount</span>}
            </div>
            <div className="pt-1 text-right">
              <p className="num text-sm font-semibold">{currency(line?.lineTotal || 0)}</p>
              {line?.gst > 0 && <p className="num text-[11px] text-muted">incl. GST {GST_RATE}% {currency(line.gst)}</p>}
            </div>
            <Button type="button" variant="ghost" size="sm" icon={Trash2} aria-label="Remove item" disabled={items.length === 1}
              onClick={() => onChange(items.filter((_, idx) => idx !== i))} />
          </div>
        );
      })}
      <div className="border-t border-border pt-3">
        <Button type="button" variant="soft" size="sm" icon={Plus} onClick={() => onChange([...items, { product: '', quantity: 1, discount: '' }])}>Add product</Button>
      </div>
    </div>
  );
}
