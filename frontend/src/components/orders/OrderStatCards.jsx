import { ArrowRight, IndianRupee } from 'lucide-react';
import { currency } from '@/lib/format';

const CARDS = [
  { tab: 'pending', label: 'Pending confirmation', hint: 'Created, needs confirmation' },
  { tab: 'confirmed', label: 'Confirmed', hint: 'Confirmed, waiting to be shipped' },
  { tab: 'in_transit', label: 'In transit', hint: 'On the way to customers' },
  { tab: 'ndr', label: 'Needs attention', hint: 'Delivery failed (NDR)', danger: true },
  { tab: 'delivered', label: 'Completed revenue', hint: 'orders completed', money: true },
];

// Quick numbers on top of the order list. Clicking one opens that tab.
// "Completed revenue" is the money of every completed (delivered) order, recalculated on each refresh (an agent: own orders only).
export default function OrderStatCards({ counts, active, onPick }) {
  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {CARDS.map((c) => {
        const on = active === c.tab;
        const n = counts[c.tab] ?? 0;
        return (
          <button
            key={c.tab} onClick={() => onPick(c.tab)}
            className={`group flex flex-col justify-between rounded-2xl border bg-surface p-5 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-pop ${on ? 'border-primary ring-1 ring-primary/30' : 'border-border'}`}
          >
            <span className="eyebrow">{c.label}</span>
            <span className={`num mt-3 font-semibold ${c.money ? 'text-3xl text-success' : `text-4xl ${c.danger && n > 0 ? 'text-danger' : 'text-foreground'}`}`}>
              {c.money ? currency(counts.revenue) : n}
            </span>
            <span className="mt-3 flex items-center justify-between text-xs text-muted">
              {c.money ? <span className="inline-flex items-center gap-1"><IndianRupee className="h-3 w-3" /><b className="num text-foreground">{n}</b> {c.hint}</span> : c.hint}
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1 group-hover:text-primary" />
            </span>
          </button>
        );
      })}
    </div>
  );
}
