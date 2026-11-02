import Badge from '@/components/ui/Badge';

// Normalized track result: { awb, status, history: [{ message, location, time }] }
export default function TrackingDetails({ data }) {
  if (!data) return null;
  const history = Array.isArray(data.history) ? data.history : [];
  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-muted p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">AWB {data.awb}</span>
        <Badge tone="primary">{data.status || 'No status yet'}</Badge>
      </div>
      {data.ndr && (
        <p className="rounded-lg bg-warning-soft p-2 text-xs text-warning">
          Delivery exception{data.ndr.status ? `: ${data.ndr.status}` : ''}{data.ndr.attempts ? ` (${data.ndr.attempts} attempt(s))` : ''}.
          {data.ndr.actions?.length ? ` Allowed actions: ${data.ndr.actions.join(', ')}.` : ''}
        </p>
      )}
      {history.length > 0 ? (
        <ol className="space-y-2 border-l border-border pl-4">
          {history.map((h, i) => (
            <li key={i} className="text-xs">
              <p className="font-medium">{h.message || 'Update'}</p>
              <p className="text-muted">{[h.location, h.time].filter(Boolean).join(' · ')}</p>
            </li>
          ))}
        </ol>
      ) : <p className="text-xs text-muted">No scan events yet.</p>}
    </div>
  );
}
