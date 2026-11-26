'use client';

import useFetch from '@/hooks/useFetch';

// Courier platforms known to the backend: [{ id, label, configured, capabilities, autoHint }]
export default function useProviders() {
  const { data, loading, error } = useFetch('/shipping/providers');
  const list = data || [];
  return {
    list,
    configured: list.filter((p) => p.configured),
    byId: Object.fromEntries(list.map((p) => [p.id, p])),
    loading,
    error,
  };
}
