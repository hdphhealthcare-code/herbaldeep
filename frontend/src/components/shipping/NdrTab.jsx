'use client';

import { useState } from 'react';
import { Phone, RefreshCw, RotateCcw, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import useList from '@/hooks/useList';
import { currency, formatDate } from '@/lib/format';
import { PROVIDER_LABEL, PROVIDER_ORDER } from '@/lib/shipping';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import Spinner from '@/components/ui/Spinner';
import LiveBadge from '@/components/common/LiveBadge';
import NdrBulkModal from './NdrBulkModal';

const TH = 'whitespace-nowrap px-4 py-3.5 text-left eyebrow';

/**
 * NDR / exceptions for EVERY courier platform (Xpressbees, Shipmozo, Ekart, Delhivery, Shiprocket).
 * The list is the orders whose courier reported a failed delivery. Admin and the NDR team see all of them,
 * an agent sees only their own orders (the API scopes it). Action = re-attempt / return, one order or a selection.
 */
export default function NdrTab() {
  const { user } = useAuth();
  const isAgent = user.role === 'agent';
  const list = useList('/shipping/ndr', { provider: '', search: '' }, 20, { refreshMs: 30000 });
  const [selected, setSelected] = useState(new Set());
  const [acting, setActing] = useState(null);

  // The modal wants order-like rows: it needs _id, orderId and the provider
  const asOrder = (r) => ({ _id: r._id, orderId: r.orderId, provider: r.provider, shipping: { provider: r.provider, lastTrackStatus: r.lastTrackStatus } });
  const toggle = (id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOn = list.rows.length > 0 && list.rows.every((r) => selected.has(r._id));
  const done = () => { setSelected(new Set()); list.reload({ silent: true }); };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input-base pl-10" placeholder="Order ID or AWB" value={list.params.search || ''} onChange={(e) => list.setParam('search', e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[['', 'All'], ...PROVIDER_ORDER.map((p) => [p, PROVIDER_LABEL[p]])].map(([value, label]) => (
            <button key={value} type="button" onClick={() => list.setParam('provider', value)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${(list.params.provider || '') === value ? 'border-primary bg-primary-soft text-primary' : 'border-border text-muted hover:text-foreground'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <LiveBadge updatedAt={list.updatedAt} />
          <Button variant="secondary" icon={RefreshCw} onClick={() => list.reload()} aria-label="Refresh" />
          <Button icon={RotateCcw} disabled={!selected.size} onClick={() => setActing(list.rows.filter((r) => selected.has(r._id)).map(asOrder))}>
            {selected.size ? `NDR action (${selected.size})` : 'NDR action'}
          </Button>
        </div>
      </div>

      {list.loading ? <Spinner /> : !list.rows.length ? (
        <EmptyState title="No NDR / exceptions" description={isAgent ? 'None of your orders has a failed delivery right now.' : 'Nothing needs your action right now.'} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="border-b border-border bg-surface-muted/60">
              <tr>
                <th className="w-12 px-4 py-3.5"><input type="checkbox" className="h-4 w-4 accent-primary" checked={allOn} aria-label="Select all"
                  onChange={() => setSelected(allOn ? new Set() : new Set(list.rows.map((r) => r._id)))} /></th>
                <th className={TH}>Order</th><th className={TH}>Customer</th><th className={TH}>Courier</th><th className={TH}>Why it failed</th><th className={TH}>Last request</th>
                <th className={`${TH} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.rows.map((r) => (
                <tr key={r._id} className="align-top transition hover:bg-surface-muted/60">
                  <td className="px-4 py-4"><input type="checkbox" className="h-4 w-4 accent-primary" checked={selected.has(r._id)} onChange={() => toggle(r._id)} aria-label={`Select ${r.orderId}`} /></td>
                  <td className="px-4 py-4">
                    <a href={`/orders/${r._id}`} className="num font-semibold text-primary hover:underline">{r.orderId}</a>
                    <p className="mt-1 text-xs text-muted">{formatDate(r.orderDate)}</p>
                    <p className="num mt-1 text-xs text-muted">{currency(r.amount)} · {r.paymentType === 'COD' ? 'COD' : 'Prepaid'}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium">{r.customer?.name}</p>
                    <p className="num mt-1 flex items-center gap-1 text-xs text-muted"><Phone className="h-3 w-3" />{r.customer?.mobile}</p>
                    <p className="mt-1 text-xs text-muted">{[r.customer?.city, r.customer?.pincode].filter(Boolean).join(', ')}</p>
                    {!isAgent && r.agent && <p className="mt-1 text-xs text-muted">Agent: {r.agent.name}</p>}
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium">{PROVIDER_LABEL[r.provider]}</p>
                    <p className="mt-1 text-xs text-muted">{r.courierName}</p>
                    <p className="num mt-1 text-xs text-muted">AWB {r.awb}</p>
                  </td>
                  <td className="max-w-[260px] px-4 py-4">
                    <p className="text-sm">{r.reason || 'Delivery attempt failed'}</p>
                    <p className="mt-1 text-xs text-muted">{r.attempts ? `${r.attempts} attempt(s)` : ''}{r.raisedAt ? `${r.attempts ? ' · ' : ''}${formatDate(r.raisedAt)}` : ''}</p>
                  </td>
                  <td className="px-4 py-4">
                    {r.lastAction ? (
                      <Badge tone="warning">{r.lastAction.action}{r.lastAction.date ? ` · ${String(r.lastAction.date).slice(0, 10)}` : ''}</Badge>
                    ) : <span className="text-xs text-muted">None yet</span>}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Button size="sm" icon={RotateCcw} onClick={() => setActing([asOrder(r)])}>Take action</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={list.meta} onChange={list.setPage} />
      <NdrBulkModal open={Boolean(acting)} orders={acting || []} onClose={() => setActing(null)} onDone={done} />
    </div>
  );
}
