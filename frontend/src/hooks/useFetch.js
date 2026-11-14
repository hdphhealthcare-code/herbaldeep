'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

// Simple one-shot GET: const { data, loading, error, reload } = useFetch('/dashboard')
export default function useFetch(endpoint, params) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!endpoint);
  const [error, setError] = useState('');
  const key = JSON.stringify(params || {});

  const load = useCallback(async () => {
    if (!endpoint) return;
    setLoading(true);
    setError('');
    try {
      setData(await api.get(endpoint, params));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, key]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load, setData };
}
