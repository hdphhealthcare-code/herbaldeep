'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

/**
 * Looks up a 6-digit pincode (state, city, localities) as soon as it is complete.
 * const { info, loading, error } = usePincode(value, (info) => fillTheForm(info))
 * `onFound` runs once per newly entered pincode, never while the person is still typing.
 */
export default function usePincode(pincode, onFound) {
  const [state, setState] = useState({ info: null, loading: false, error: '' });
  const cb = useRef(onFound);
  useEffect(() => { cb.current = onFound; }, [onFound]);

  useEffect(() => {
    const pin = String(pincode || '').trim();
    if (!/^\d{6}$/.test(pin)) {
      setState({ info: null, loading: false, error: '' });
      return undefined;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: '' }));
    api.get(`/pincode/${pin}`)
      .then((info) => {
        if (cancelled) return;
        setState({ info, loading: false, error: '' });
        cb.current?.(info);
      })
      .catch((err) => { if (!cancelled) setState({ info: null, loading: false, error: err.message }); });
    return () => { cancelled = true; };
  }, [pincode]);

  return state;
}
