'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Copy, Eye, EyeOff, FileText, MoreHorizontal, Pencil, Phone, RotateCcw, Truck, XCircle, Eye as View, Route } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { CANCELLABLE_STATUS, EDITABLE_STATUS, PRE_CONFIRM_STATUS, canCreateOrders, isAdminRole } from '@/lib/constants';
import { currency } from '@/lib/format';
import { PROVIDER_LABEL } from '@/lib/shipping';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Menu, { MenuDivider, MenuItem } from '@/components/ui/Menu';

import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/common/StatusBadge';
import LabelModal from '@/components/shipping/LabelModal';

const TH = 'whitespace-nowrap px-4 py-3.5 text-left eyebrow';

// "**********" with an eye to reveal the number (the list is full of customer phone numbers)
function Phone10({ value }) {
  const [show, setShow] = useState(false);
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); setShow((s) => !s); }} className="num mt-0.5 flex items-center gap-1.5 text-xs text-muted hover:text-foreground">
      <Phone className="h-3 w-3" />{show ? value : '**********'}{show ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
    </button>
  );
}

const copy = (text) => (e) => {
  e.stopPropagation();
  navigator.clipboard?.writeText(text).then(() => toast.success('Copied'));
};

/**
 * Xpressbees-style order table: order + AWB, customer, products, payment, status, address (from -> to), shipping, actions.
 * What each role sees on a row:
 *   agent  -> Confirm (own pending orders), Edit until confirmed, Clone. Never Ship.
 *   admin  -> Confirm, Ship now (confirmed orders only), Edit, Clone, Label, Cancel
 *   ndr    -> NDR action (re-attempt) on failed deliveries; view only otherwise
 *   NDR action is open to admin, NDR team and the agent (own orders), for every courier platform
 */
export default function OrdersTable({ rows, loading, selected, setSelected, role, onChanged, onNdr }) {
  const admin = isAdminRole(role);
  const creator = canCreateOrders(role);
  const ndrTeam = role === 'ndr' || role === 'agent' || admin; // an agent only ever has their own orders in the list
  const router = useRouter();
  const [labelOrder, setLabelOrder] = useState(null);

  const allOn = rows.length > 0 && rows.every((r) => selected.has(r._id));
  const toggleAll = () => setSelected(allOn ? new Set() : new Set(rows.map((r) => r._id)));
  const toggle = (id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const cancel = async (r) => {
    const booked = r.shipping?.status === 'booked';
    if (!window.confirm(`Cancel order ${r.orderId}?${booked ? '\n\nThe shipment is cancelled with the courier too.' : ''}\n\nReserved stock goes back to inventory.`)) return;
    try {
      await api.post(`/orders/${r._id}/cancel`, {});
      toast.success(`${r.orderId} cancelled`);
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const confirm = async (r) => {
    try {
      await api.post(`/orders/${r._id}/confirm`, {});
      toast.success(`${r.orderId} confirmed`);
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="divide-y divide-border" aria-busy="true" aria-label="Loading orders">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex animate-pulse items-center gap-6 px-5 py-5">
            <div className="h-4 w-4 rounded bg-surface-muted" />
            <div className="w-32 space-y-2"><div className="h-3.5 rounded bg-surface-muted" /><div className="h-3 w-20 rounded bg-surface-muted" /></div>
            <div className="w-40 space-y-2"><div className="h-3.5 rounded bg-surface-muted" /><div className="h-3 w-24 rounded bg-surface-muted" /></div>
            <div className="hidden w-48 space-y-2 md:block"><div className="h-3.5 rounded bg-surface-muted" /><div className="h-3 w-16 rounded bg-surface-muted" /></div>
            <div className="ml-auto h-8 w-24 rounded-xl bg-surface-muted" />
          </div>
        ))}
      </div>
    );
  }
  if (!rows.length) return <EmptyState title="No orders found" description="Orders matching this tab and filters will show up here." />;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-sm">
          <thead className="border-b border-border bg-surface-muted/60">
            <tr>
              <th className="w-12 px-4 py-3.5"><input type="checkbox" className="h-4 w-4 accent-primary" checked={allOn} onChange={toggleAll} aria-label="Select all" /></th>
              <th className={TH}>Order details</th>
              <th className={TH}>Customer details</th>
              <th className={TH}>Product details</th>
              <th className={TH}>Payment</th>
              <th className={TH}>Status</th>
              <th className={TH}>Address details</th>
              <th className={TH}>Shipping details</th>
              <th className={`${TH} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const s = r.shipping || {};
              const booked = s.status === 'booked';
              const awb = s.awb || r.courier?.awb;
              const pending = PRE_CONFIRM_STATUS.includes(r.status);
              // an agent edits only until the order is confirmed; an admin until it is shipped
              const editable = creator && !booked && (admin ? EDITABLE_STATUS.includes(r.status) : pending);
              const shippable = admin && !booked && r.status === 'confirmed';
              const ndrOpen = ndrTeam && r.status === 'ndr' && booked && Boolean(awb);
              const units = r.items.reduce((n, i) => n + i.quantity, 0);
              const cod = r.payment?.type === 'COD';
              const grams = s.weight || r.parcel?.weight;
              return (
                <tr key={r._id} onClick={() => router.push(`/orders/${r._id}`)} className="group cursor-pointer align-top transition hover:bg-surface-muted/60">
                  <td className="px-4 py-5" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="h-4 w-4 accent-primary" checked={selected.has(r._id)} onChange={() => toggle(r._id)} aria-label={`Select ${r.orderId}`} />
                  </td>
                  <td className="px-4 py-5">
                    <Link href={`/orders/${r._id}`} onClick={(e) => e.stopPropagation()} className="num text-[15px] font-semibold text-primary hover:underline">{r.orderId}</Link>
                    <p className="mt-1.5 text-xs text-muted">{new Date(r.orderDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    {awb ? (
                      <p className="mt-1 text-xs text-muted">AWB# <button onClick={copy(awb)} title="Copy AWB" className="num inline-flex items-center gap-1 font-semibold text-primary hover:underline">{awb}<Copy className="h-3 w-3 opacity-0 transition group-hover:opacity-70" /></button></p>
                    ) : booked ? <p className="mt-1 text-xs text-warning">AWB pending</p> : null}
                    <p className="mt-1 text-xs text-muted">Channel : <b className="font-semibold text-primary">Custom</b></p>
                  </td>
                  <td className="px-4 py-5">
                    <p className="font-medium">{r.customer?.name}</p>
                    <Phone10 value={r.customer?.mobile} />
                    <p className="mt-1.5 text-xs text-muted">{[r.customer?.city, r.customer?.pincode].filter(Boolean).join(', ')}</p>
                  </td>
                  <td className="px-4 py-5">
                    <p className="max-w-[210px] truncate font-medium">{r.items[0]?.name}</p>
                    {r.items[0]?.sku && <p className="mt-1 text-xs text-muted">SKU <span className="num">{r.items[0].sku}</span></p>}
                    <p className="mt-1 text-xs text-muted">Qty <b className="num text-foreground">{units}</b>{r.items.length > 1 && <span className="ml-2 rounded bg-surface-muted px-1.5 py-0.5">+{r.items.length - 1} more</span>}</p>
                  </td>
                  <td className="px-4 py-5">
                    <p className="num font-semibold">{currency(cod ? r.payment.codAmount || r.totalAmount : r.totalAmount)}</p>
                    <div className="mt-1.5"><Badge tone={cod ? 'warning' : 'success'}>{cod ? 'COD' : 'Prepaid'}</Badge></div>
                    <p className="mt-1.5 text-[11px] uppercase tracking-wide text-muted"><span className="num normal-case text-foreground">{currency(r.totalAmount)}</span> order total</p>
                  </td>
                  <td className="px-4 py-5">
                    <StatusBadge value={r.status} />
                    {s.lastTrackStatus && booked && <p className="mt-1.5 max-w-[150px] text-xs text-muted">{s.lastTrackStatus}</p>}
                    {r.agent && role !== 'agent' && <p className="mt-1.5 text-xs text-muted">Agent: {r.agent.name}</p>}
                    {r.status === 'ndr' && s.ndr?.lastAction && <p className="mt-1.5 text-xs text-warning">Re-attempt requested{s.ndr.lastAction.date ? ` for ${String(s.ndr.lastAction.date).slice(0, 10)}` : ''}</p>}
                  </td>
                  <td className="px-4 py-5">
                    <p className="font-medium">{r.warehouse?.city || '-'}{r.warehouse?.pincode ? <span className="num text-muted"> ({r.warehouse.pincode})</span> : ''}</p>
                    <p className="my-0.5 flex items-center gap-1 text-[11px] font-semibold uppercase text-muted"><Route className="h-3 w-3" /> To</p>
                    <p className="font-medium">{r.customer?.city || '-'}{r.customer?.pincode ? <span className="num text-muted"> ({r.customer.pincode})</span> : ''}</p>
                  </td>
                  <td className="px-4 py-5">
                    {booked ? (
                      <>
                        <p className="font-medium">{s.courierName || PROVIDER_LABEL[s.provider || 'xpressbees']}</p>
                        <p className="mt-1 text-xs text-muted">{PROVIDER_LABEL[s.provider || 'xpressbees']}{s.mode ? ` · ${s.mode === 'air' ? 'Air' : 'Surface'}` : ''}</p>
                        {grams && <p className="num mt-1 text-xs text-muted">{(grams / 1000).toFixed(2)} kg</p>}
                      </>
                    ) : <span className="text-xs text-muted">Not shipped yet{grams ? <span className="num"> · {(grams / 1000).toFixed(2)} kg</span> : ''}</span>}
                  </td>
                  <td className="px-4 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {creator && pending && <Button size="sm" icon={CheckCircle2} onClick={() => confirm(r)}>Confirm</Button>}
                      {shippable && <Button size="sm" icon={Truck} onClick={() => router.push(`/orders/${r._id}/ship`)}>Ship now</Button>}
                      {ndrOpen && <Button size="sm" variant="secondary" icon={RotateCcw} onClick={() => onNdr?.([r])}>NDR action</Button>}
                      <Menu width={216} trigger={(p) => (
                        <button {...p} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted transition hover:border-foreground/25 hover:text-foreground" aria-label="More actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      )}>
                        {(close) => (
                          <>
                            <MenuItem close={close} icon={View} href={`/orders/${r._id}`}>View order</MenuItem>
                            {creator && pending && <MenuItem close={close} icon={CheckCircle2} onClick={() => confirm(r)}>Confirm order</MenuItem>}
                            {shippable && <MenuItem close={close} icon={Truck} href={`/orders/${r._id}/ship`}>Ship now</MenuItem>}
                            {ndrOpen && <MenuItem close={close} icon={RotateCcw} onClick={() => onNdr?.([r])}>NDR action (re-attempt)</MenuItem>}
                            {editable && <MenuItem close={close} icon={Pencil} href={`/orders/${r._id}/edit`}>Edit order</MenuItem>}
                            {creator && <MenuItem close={close} icon={Copy} href={`/orders/new?clone=${r._id}`}>Clone order</MenuItem>}
                            {admin && booked && awb && <MenuItem close={close} icon={FileText} onClick={() => setLabelOrder(r)}>Shipping label</MenuItem>}
                            {admin && CANCELLABLE_STATUS.includes(r.status) && (<><MenuDivider /><MenuItem close={close} icon={XCircle} danger onClick={() => cancel(r)}>Cancel order</MenuItem></>)}
                          </>
                        )}
                      </Menu>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <LabelModal open={Boolean(labelOrder)} order={labelOrder} onClose={() => setLabelOrder(null)} />
    </>
  );
}
