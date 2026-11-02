'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

/**
 * Paginated list fetcher with search + filters.
 * const { rows, meta, loading, params, setParam, setPage, reload } = useList('/orders', { status: '' })
 */
export default function useList(endpoint, initial = {}, limit = 10) {
  const [params, setParams] = useState({ page: 1, limit, ...initial });
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    try {
      const res = await api.get(endpoint, params);
      if (id !== seq.current) return; // ignore stale responses
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      toast.error(err.message);
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [endpoint, params]);

  useEffect(() => { load(); }, [load]);

  const setParam = (key, value) => setParams((p) => ({ ...p, [key]: value, page: 1 }));
  const setPage = (page) => setParams((p) => ({ ...p, page }));

  return { rows, meta, loading, params, setParam, setPage, reload: load };
}
