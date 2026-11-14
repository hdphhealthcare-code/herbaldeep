import Spinner from './Spinner';
import EmptyState from './EmptyState';

/**
 * columns: [{ key, label, render?(row), className? }]
 */
export default function DataTable({ columns, rows, loading, onRowClick, emptyTitle, emptyDescription, rowKey = '_id' }) {
  if (loading) return <Spinner />;
  if (!rows.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-surface-muted/60">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`eyebrow whitespace-nowrap px-4 py-3.5 ${c.className || ''}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr
              key={row[rowKey]}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? 'cursor-pointer hover:bg-surface-muted/70' : ''}
            >
              {columns.map((c) => (
                <td key={c.key} className={`px-4 py-3 align-middle ${c.className || ''}`}>
                  {c.render ? c.render(row) : row[c.key] ?? '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
