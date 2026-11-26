'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

/**
 * Paginated list fetcher with search + filters.
 * const { rows, meta, loading, params, setParam, setPage, reload, updatedAt } = useList('/orders', { status: '' }, 10, { refreshMs: 20000 })
 * With `refreshMs` the list refreshes itself quietly in the background (no spinner) while the tab is visible.
 */
export default function useList(endpoint, initial = {}, limit = 10, { refreshMs = 0 } = {}) {
  const [params, setParams] = useState({ page: 1, limit, ...initial });
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const seq = useRef(0);

  const load = useCallback(async ({ silent = false } = {}) => {
    const id = ++seq.current;
    if (!silent) setLoading(true);
    try {
      const res = await api.get(endpoint, params);
      if (id !== seq.current) return; // ignore stale responses
      setRows(res.data);
      setMeta(res.meta);
      setUpdatedAt(new Date());
    } catch (err) {
      if (!silent) toast.error(err.message);
    } finally {
      if (id === seq.current && !silent) setLoading(false);
    }
  }, [endpoint, params]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!refreshMs) return undefined;
    const tick = () => { if (document.visibilityState === 'visible') load({ silent: true }); };
    const t = setInterval(tick, refreshMs);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick); };
  }, [refreshMs, load]);

  const setParam = (key, value) => setParams((p) => ({ ...p, [key]: value, page: 1 }));
  const setPage = (page) => setParams((p) => ({ ...p, page }));

  return { rows, meta, loading, params, setParam, setPage, reload: load, updatedAt };
}
