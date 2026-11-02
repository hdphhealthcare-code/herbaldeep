'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

// Pickup warehouses (stored in our DB) as <Select> options. Returns { options, rows, loading, error, reload }.
export default function useWarehouses() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await api.get('/shipping/warehouses'));
    } catch (err) {
      setRows([]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const options = rows.map((w) => ({ value: String(w._id), label: `${w.title} (${w.pincode})`, raw: w }));
  const defaultId = (rows.find((w) => w.isDefault) || rows[0])?._id || '';
  return { options, rows, loading, error, reload: load, defaultId: String(defaultId) };
}
