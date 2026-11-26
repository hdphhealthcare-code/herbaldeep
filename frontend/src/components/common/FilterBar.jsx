import { Search } from 'lucide-react';
import { Select } from '@/components/ui/FormField';

/**
 * Search box + optional selects + date range.
 * filters: [{ key, placeholder, options }]
 */
export default function FilterBar({ params, setParam, searchPlaceholder = 'Search...', filters = [], dates = false }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          className="input-base pl-10"
          placeholder={searchPlaceholder}
          value={params.search || ''}
          onChange={(e) => setParam('search', e.target.value)}
        />
      </div>
      {filters.map((f) => (
        <Select
          key={f.key}
          wrapperClass="w-44"
          placeholder={f.placeholder}
          options={f.options}
          value={params[f.key] || ''}
          onChange={(e) => setParam(f.key, e.target.value)}
        />
      ))}
      {dates && (
        <>
          <input type="date" className="input-base w-40" value={params.from || ''} onChange={(e) => setParam('from', e.target.value)} aria-label="From date" />
          <input type="date" className="input-base w-40" value={params.to || ''} onChange={(e) => setParam('to', e.target.value)} aria-label="To date" />
        </>
      )}
    </div>
  );
}
