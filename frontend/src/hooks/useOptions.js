'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

// Loads a list endpoint as <Select> options: [{ value, label, raw }]
export default function useOptions(endpoint, params = {}, labelKey = 'name') {
  const [options, setOptions] = useState([]);
  const key = JSON.stringify(params);

  useEffect(() => {
    if (!endpoint) return;
    let cancelled = false;
    (async () => {
      try {
        const all = [];
        for (let page = 1; page <= 20; page += 1) { // the API returns at most 100 per page: read them all
          const res = await api.get(endpoint, { limit: 100, page, ...params });
          all.push(...res.data);
          if (page >= (res.meta?.pages || 1)) break;
        }
        if (!cancelled) setOptions(all.map((d) => ({ value: d._id, label: d[labelKey], raw: d })));
      } catch {
        if (!cancelled) setOptions([]);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, key, labelKey]);

  return options;
}
