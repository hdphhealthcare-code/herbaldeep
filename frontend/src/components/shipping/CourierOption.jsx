import { Check, Clock, Star, Zap } from 'lucide-react';
import { currency } from '@/lib/format';

const TAG = {
  recommended: { label: 'Recommended', cls: 'bg-success-soft text-success' },
  cheapest: { label: 'Cheapest', cls: 'bg-info-soft text-info' },
  fastest: { label: 'Fastest', cls: 'bg-primary-soft text-primary' },
};

export const Stars = ({ value }) => (value ? (
  <span className="inline-flex items-center gap-1 rounded-md bg-warning-soft px-1.5 py-0.5 text-xs font-semibold text-warning" title={`Courier rating ${value} out of 5`}>
    <Star className="h-3 w-3 fill-current" /><span className="num">{value.toFixed(1)}</span>
  </span>
) : null);

export const ModeBadge = ({ mode }) => (
  <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${mode === 'air' ? 'bg-primary text-primary-foreground' : 'bg-info text-primary-foreground'}`}>
    {mode === 'air' ? 'Air' : 'Surface'}
  </span>
);

const kg = (grams) => (grams ? `${(Number(grams) > 20 ? Number(grams) / 1000 : Number(grams)).toFixed(2)} K.G` : '-');

/** One courier service row on the ship page: select circle, name, mode, rating, tags, weight and charge. */
export default function CourierOption({ c, platform, selected, onSelect, weightKg }) {
  const price = Number.isFinite(Number(c.rate)) ? currency(c.rate) : c.rate ?? '-';
  return (
    <button
      type="button" onClick={onSelect} aria-pressed={selected}
      className={`grid w-full grid-cols-[28px_1fr_120px_130px] items-center gap-4 rounded-2xl border bg-surface p-5 text-left shadow-card transition hover:border-primary/50 ${selected ? 'border-primary bg-primary-soft/40 ring-1 ring-primary/30' : 'border-border'}`}
    >
      <span className={`flex h-6 w-6 items-center justify-center rounded-md border-2 ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>{selected && <Check className="h-4 w-4" />}</span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-semibold">{c.name}</span>
          {(c.tags || []).map((t) => TAG[t] && <span key={t} className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TAG[t].cls}`}>{TAG[t].label}</span>)}
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          <ModeBadge mode={c.mode} />
          <span>via {platform}</span>
          <Stars value={c.rating} />
          {c.eta && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {String(c.eta).includes('day') ? c.eta : `${c.eta} days`}</span>}
          {c.autoPickup && <span className="inline-flex items-center gap-1"><Zap className="h-3 w-3" /> Auto pickup</span>}
        </span>
      </span>
      <span className="num rounded-lg border border-border bg-surface-muted px-3 py-2 text-center text-sm font-semibold">{c.chargeableWeight ? kg(c.chargeableWeight) : `${weightKg.toFixed(2)} K.G`}</span>
      <span className="text-right">
        <span className="num block text-lg font-semibold">{price}</span>
        {c.freight != null && <span className="num block text-[11px] text-muted">freight {currency(c.freight)}{c.cod ? ` + COD ${currency(c.cod)}` : ''}</span>}
      </span>
    </button>
  );
}
