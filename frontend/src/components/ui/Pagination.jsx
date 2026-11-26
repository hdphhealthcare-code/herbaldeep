import { ChevronLeft, ChevronRight } from 'lucide-react';

const SIZES = [10, 25, 50, 100];

// "Showing 1-10 of 42 | Items per page [50] | Previous 1 2 3 Next"
export default function Pagination({ meta, onChange, onLimit }) {
  if (!meta || !meta.total) return null;
  const { page, pages, total, limit = 10 } = meta;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const around = [...new Set([1, page - 1, page, page + 1, pages])].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4 text-sm text-muted">
      <span>Showing <b className="num text-foreground">{from}-{to}</b> of <b className="num text-foreground">{total}</b></span>
      <div className="flex flex-wrap items-center gap-4">
        {onLimit && (
          <label className="flex items-center gap-2 text-xs">
            Items per page
            <select className="input-base w-auto py-1.5" value={limit} onChange={(e) => onLimit(Number(e.target.value))}>
              {SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
        {pages > 1 && (
          <div className="flex items-center gap-1">
            <button className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-surface-muted disabled:opacity-40" disabled={page <= 1} onClick={() => onChange(page - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            {around.map((p, i) => (
              <span key={p} className="flex items-center gap-1">
                {i > 0 && p - around[i - 1] > 1 && <span className="px-1">...</span>}
                <button onClick={() => onChange(p)} className={`num h-8 min-w-8 rounded-lg px-2 text-xs font-semibold ${p === page ? 'bg-primary text-primary-foreground shadow-glow' : 'hover:bg-surface-muted'}`}>{p}</button>
              </span>
            ))}
            <button className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-surface-muted disabled:opacity-40" disabled={page >= pages} onClick={() => onChange(page + 1)}>
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
