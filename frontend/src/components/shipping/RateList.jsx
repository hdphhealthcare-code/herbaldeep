import { currency } from '@/lib/format';

// Rates grouped by courier platform. With `selected`/`onSelect` the rows become choosable (booking form).
// selected = { provider, courierId }  (courierId '' = "Auto" for that provider)
export default function RateList({ groups, selected, onSelect }) {
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.provider} className="rounded-lg border border-border">
          <div className="flex items-center justify-between border-b border-border bg-surface-muted px-3 py-2">
            <span className="text-sm font-semibold">{g.label}</span>
            {g.error && <span className="text-xs text-danger">{g.error}</span>}
            {!g.error && !g.couriers.length && <span className="text-xs text-muted">No couriers for this route</span>}
          </div>
          {(g.couriers.length > 0 || onSelect) && !g.error && (
            <ul className="divide-y divide-border">
              {onSelect && g.couriers.length > 0 && (
                <li className="p-3">
                  <label className="flex cursor-pointer items-center gap-3 text-sm">
                    <input type="radio" name="courier" checked={selected.provider === g.provider && selected.courierId === ''}
                      onChange={() => onSelect(g.provider, '')} />
                    <span>
                      <span className="block font-medium">Auto</span>
                      <span className="block text-xs text-muted">{g.autoHint}</span>
                    </span>
                  </label>
                </li>
              )}
              {g.couriers.map((c) => (
                <li key={`${g.provider}-${c.id}`} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  {onSelect ? (
                    <label className="flex cursor-pointer items-center gap-3 text-sm">
                      <input type="radio" name="courier" checked={selected.provider === g.provider && selected.courierId === c.id}
                        onChange={() => onSelect(g.provider, c.id)} />
                      <Info c={c} />
                    </label>
                  ) : <div className="text-sm"><Info c={c} /></div>}
                  <span className="text-sm font-semibold">{c.rate != null ? (Number.isNaN(Number(c.rate)) ? c.rate : currency(c.rate)) : '-'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function Info({ c }) {
  const bits = [];
  if (c.service) bits.push(c.service);
  if (c.freight != null) bits.push(`Freight ${currency(c.freight)}${c.cod ? ` + COD ${currency(c.cod)}` : ''}`);
  if (c.chargeableWeight) bits.push(`Chargeable ${c.chargeableWeight} g`);
  if (c.eta) bits.push(`Delivery ${c.eta}`);
  if (c.autoPickup) bits.push('Pickup auto-scheduled');
  return (
    <span>
      <span className="block font-medium">{c.name}</span>
      {bits.length > 0 && <span className="block text-xs text-muted">{bits.join(' · ')}</span>}
    </span>
  );
}
