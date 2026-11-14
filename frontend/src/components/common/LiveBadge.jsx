'use client';

import { useEffect, useState } from 'react';

const ago = (date, now) => {
  const s = Math.max(Math.round((now - date.getTime()) / 1000), 0);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

// Pulsing "Live" pill with the time of the last refresh. `live=false` shows a quiet "Updates stopped" note.
export default function LiveBadge({ updatedAt, live = true, label = 'Live' }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
      <span className="relative flex h-2 w-2">
        {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${live ? 'bg-success' : 'bg-muted'}`} />
      </span>
      <span className="font-medium text-foreground">{live ? label : 'Final status'}</span>
      {updatedAt && <span>· updated {ago(updatedAt, now)}</span>}
    </span>
  );
}
