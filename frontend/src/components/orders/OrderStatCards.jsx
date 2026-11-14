import { ArrowRight } from 'lucide-react';

const CARDS = [
  { tab: 'pending', label: 'Pending confirmation', hint: 'Created, needs confirmation' },
  { tab: 'confirmed', label: 'Confirmed', hint: 'Confirmed, waiting to be shipped' },
  { tab: 'in_transit', label: 'In transit', hint: 'On the way to customers' },
  { tab: 'ndr', label: 'Needs attention', hint: 'Delivery failed (NDR)', danger: true },
];

// Four quick numbers on top of the order list. Clicking one opens that tab.
export default function OrderStatCards({ counts, active, onPick }) {
  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {CARDS.map((c) => {
        const on = active === c.tab;
        const n = counts[c.tab] ?? 0;
        return (
          <button
            key={c.tab} onClick={() => onPick(c.tab)}
            className={`group flex flex-col justify-between rounded-2xl border bg-surface p-5 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-pop ${on ? 'border-primary ring-1 ring-primary/30' : 'border-border'}`}
          >
            <span className="eyebrow">{c.label}</span>
            <span className={`num mt-3 text-4xl font-semibold ${c.danger && n > 0 ? 'text-danger' : 'text-foreground'}`}>{n}</span>
            <span className="mt-3 flex items-center justify-between text-xs text-muted">
              {c.hint}
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1 group-hover:text-primary" />
            </span>
          </button>
        );
      })}
    </div>
  );
}
