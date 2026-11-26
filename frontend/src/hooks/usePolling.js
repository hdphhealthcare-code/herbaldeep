'use client';

import { useEffect, useRef } from 'react';

// Runs `fn` every `ms` while the browser tab is visible (and once more when the tab comes back). Stops when `enabled` is false.
export default function usePolling(fn, ms, enabled = true) {
  const saved = useRef(fn);
  useEffect(() => { saved.current = fn; }, [fn]);

  useEffect(() => {
    if (!enabled || !ms) return undefined;
    const tick = () => { if (document.visibilityState === 'visible') saved.current(); };
    const t = setInterval(tick, ms);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick); };
  }, [ms, enabled]);
}
