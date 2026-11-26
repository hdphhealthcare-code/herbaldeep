import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

let cached = null; // one request for the whole session

/** Settings the CRM label needs from the server (your own GSTIN). */
export default function useLabelMeta() {
  const [meta, setMeta] = useState(cached || { sellerGstin: '' });
  useEffect(() => {
    if (cached) return;
    api.get('/orders/label-meta').then((m) => { cached = m; setMeta(m); }).catch(() => {});
  }, []);
  return meta;
}
