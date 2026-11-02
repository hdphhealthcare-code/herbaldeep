'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

// Loads a list endpoint as <Select> options: [{ value, label, raw }]
export default function useOptions(endpoint, params = {}, labelKey = 'name') {
  const [options, setOptions] = useState([]);
  const key = JSON.stringify(params);

  useEffect(() => {
    if (!endpoint) return;
    api.get(endpoint, { limit: 100, ...params })
      .then((res) => setOptions(res.data.map((d) => ({ value: d._id, label: d[labelKey], raw: d }))))
      .catch(() => setOptions([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, key, labelKey]);

  return options;
}
