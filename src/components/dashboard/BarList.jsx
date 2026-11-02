import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';

// Horizontal bars for zone-wise / agent-wise summaries
export default function BarList({ title, rows }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <Card title={title}>
      {!rows.length ? <EmptyState title="No data yet" /> : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r._id || r.name}>
              <div className="mb-1 flex justify-between text-sm"><span>{r.name || 'Unknown'}</span><span className="font-medium">{r.count}</span></div>
              <div className="h-2 rounded-full bg-primary-soft">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${(r.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
