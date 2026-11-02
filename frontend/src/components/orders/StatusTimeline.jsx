import Card from '@/components/ui/Card';
import StatusBadge from '@/components/common/StatusBadge';
import { formatDateTime } from '@/lib/format';

export default function StatusTimeline({ history = [] }) {
  const items = [...history].reverse();
  return (
    <Card title="Status history">
      <ol className="relative space-y-5 border-l border-border pl-5">
        {items.map((h, i) => (
          <li key={i} className="relative">
            <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
            <StatusBadge value={h.status} />
            <p className="mt-1 text-xs text-muted">
              {formatDateTime(h.at)}{h.by?.name ? ` · ${h.by.name}` : ''}
            </p>
            {h.note && <p className="mt-0.5 text-sm">{h.note}</p>}
          </li>
        ))}
      </ol>
    </Card>
  );
}
