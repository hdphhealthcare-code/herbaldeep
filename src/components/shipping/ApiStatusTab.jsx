'use client';

import { Wifi } from 'lucide-react';
import useFetch from '@/hooks/useFetch';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';

const ENV_HINT = {
  xpressbees: 'XPRESSBEES_EMAIL and XPRESSBEES_PASSWORD',
  shipmozo: 'SHIPMOZO_PUBLIC_KEY and SHIPMOZO_PRIVATE_KEY',
  ekart: 'EKART_CLIENT_ID, EKART_USERNAME, EKART_PASSWORD and the EKART_SELLER_* details',
};

// Connection check for every courier platform, plus the Xpressbees courier list
export default function ApiStatusTab() {
  const status = useFetch('/shipping/status');
  const xbOnline = (status.data || []).find((p) => p.id === 'xpressbees')?.online;
  const couriers = useFetch(xbOnline ? '/shipping/couriers?provider=xpressbees' : null);

  return (
    <div className="space-y-6 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Keys live in backend/.env. After changing them, restart the backend.</p>
        <Button variant="secondary" icon={Wifi} onClick={status.reload}>Test again</Button>
      </div>
      {status.loading ? <Spinner /> : (
        <div className="grid gap-6 lg:grid-cols-2">
          {(status.data || []).map((p) => (
            <Card key={p.id} title={p.label}>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>Keys in backend/.env</span>
                  <Badge tone={p.configured ? 'success' : 'danger'}>{p.configured ? 'Configured' : 'Missing'}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>API connection</span>
                  <Badge tone={p.online ? 'success' : 'danger'}>{p.online ? 'Online' : 'Not working'}</Badge>
                </div>
                <p className="text-xs text-muted">{p.message}</p>
                {!p.configured && <p className="text-xs text-muted">Set {ENV_HINT[p.id]} in backend/.env, then restart the server.</p>}
              </div>
            </Card>
          ))}
        </div>
      )}
      {xbOnline && (
        <Card title="Xpressbees couriers on your account">
          {couriers.loading ? <Spinner /> : couriers.error ? <p className="text-sm text-danger">{couriers.error}</p> : (
            <ul className="divide-y divide-border text-sm">
              {(couriers.data || []).map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2"><span>{c.name}</span><span className="text-xs text-muted">ID {c.id}</span></li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
