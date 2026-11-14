'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, RefreshCw, Sparkles, Truck, TriangleAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { currency } from '@/lib/format';
import { PROVIDER_LABEL, PROVIDER_ORDER } from '@/lib/shipping';
import useFetch from '@/hooks/useFetch';
import useWarehouses from '@/hooks/useWarehouses';
import useProviders from '@/hooks/useProviders';
import RoleGuard from '@/components/layout/RoleGuard';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { Select } from '@/components/ui/FormField';
import CourierOption from '@/components/shipping/CourierOption';

// Cheapest first, always. Nothing to choose: the price order is fixed.
const byPrice = (a, b) => (Number.isFinite(Number(a.rate)) ? Number(a.rate) : 1e9) - (Number.isFinite(Number(b.rate)) ? Number(b.rate) : 1e9);

// Marks the best options across every platform: cheapest, fastest and the recommended one (price + rating)
function tagAll(groups) {
  const all = groups.flatMap((g) => g.couriers).filter((c) => Number.isFinite(Number(c.rate)));
  if (!all.length) return groups;
  all.forEach((c) => { c.tags = []; });
  const minRate = Math.min(...all.map((c) => Number(c.rate)));
  const cheapest = all.find((c) => Number(c.rate) === minRate);
  cheapest.tags.push('cheapest');
  const withDays = all.filter((c) => c.etaDays);
  if (withDays.length) { const min = Math.min(...withDays.map((c) => c.etaDays)); withDays.find((c) => c.etaDays === min).tags.push('fastest'); }
  const rated = all.filter((c) => c.rating);
  const best = rated.length
    ? all.reduce((top, c) => { const sc = 0.55 * (minRate / Number(c.rate)) + 0.45 * ((c.rating || 3) / 5); return !top || sc > top.sc ? { c, sc } : top; }, null).c
    : cheapest;
  best.tags.push('recommended');
  return groups.map((g) => ({ ...g }));
}

const Fact = ({ label, children }) => (<div><p className="eyebrow">{label}</p><div className="mt-1.5">{children}</div></div>);

function ShipOrder() {
  const { id } = useParams();
  const router = useRouter();
  const { data: order, loading } = useFetch(`/orders/${id}`);
  const wh = useWarehouses();
  const providers = useProviders();
  const [warehouseId, setWarehouseId] = useState('');
  const [groups, setGroups] = useState(null); // one entry per platform; each fills in as soon as that courier answers
  const [fetching, setFetching] = useState(false);
  const [mode, setMode] = useState('all');
  const [platform, setPlatform] = useState('all');
  const [choice, setChoice] = useState('auto'); // 'auto' or `${provider}:${courierId}`
  const [autoPickup, setAutoPickup] = useState(true);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    if (order?.warehouse?._id && !warehouseId) setWarehouseId(String(order.warehouse._id));
  }, [order, warehouseId]);
  useEffect(() => {
    if (wh.loading) return;
    if (!wh.options.some((o) => o.value === warehouseId) && wh.defaultId) setWarehouseId(wh.defaultId);
  }, [wh.loading, wh.options, wh.defaultId, warehouseId]);

  const origin = wh.rows.find((w) => String(w._id) === warehouseId);
  const c = order?.customer || {};
  const missing = [!c.pincode && 'pincode', !c.state && 'state'].filter(Boolean);

  // Every connected platform is asked at the same time and shows up the moment it answers (a slow courier never holds the others back)
  const seq = useRef(0);
  const loadRates = useCallback(async () => {
    if (!order || !warehouseId || providers.loading) return;
    const ids = PROVIDER_ORDER.filter((p) => providers.byId[p]?.configured);
    const run = ++seq.current;
    setFetching(true);
    setChoice('auto');
    setGroups(ids.map((p) => ({ provider: p, label: PROVIDER_LABEL[p], couriers: [], loading: true })));
    await Promise.all(ids.map(async (p) => {
      let group;
      try {
        const res = await api.post(`/shipping/orders/${id}/rates`, { warehouseId, providers: [p] });
        group = res[0] || { provider: p, label: PROVIDER_LABEL[p], couriers: [] };
      } catch (err) {
        group = { provider: p, label: PROVIDER_LABEL[p], couriers: [], error: err.message };
      }
      if (run === seq.current) setGroups((cur) => (cur || []).map((g) => (g.provider === p ? { ...group, loading: false } : g)));
    }));
    if (run === seq.current) {
      // "cheapest / fastest / recommended" tags are worked out across all platforms, once everything is in
      setGroups((cur) => tagAll(cur || []));
      setFetching(false);
    }
  }, [id, order, warehouseId, providers.loading, providers.byId]);

  useEffect(() => { if (!missing.length) loadRates(); }, [loadRates]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { seq.current += 1; }, []);

  const all = useMemo(() => (groups || []).flatMap((g) => g.couriers.map((cr) => ({ ...cr, provider: g.provider, platform: g.label }))), [groups]);
  // "Auto Allocate" picks inside the chosen platform (or across all of them when no platform is chosen)
  const pool = platform === 'all' ? all : all.filter((x) => x.provider === platform);
  const recommended = pool.find((x) => x.tags?.includes('recommended')) || [...pool].sort(byPrice)[0];
  const visible = all
    .filter((x) => (mode === 'all' || x.mode === mode) && (platform === 'all' || x.provider === platform))
    .sort(byPrice);
  const count = (fn) => all.filter(fn).length;
  const errors = (groups || []).filter((g) => g.error && (platform === 'all' || g.provider === platform));

  const par = order?.parcel || {};
  const dead = (par.weight || 0) / 1000;
  const volumetric = ((par.length || 0) * (par.width || 0) * (par.height || 0)) / 5000;
  const weightKg = Math.max(dead, volumetric);

  const picked = choice === 'auto' ? recommended : all.find((x) => `${x.provider}:${x.id}` === choice);

  const ship = async () => {
    const body = { warehouseId, autoPickup };
    if (picked) Object.assign(body, { provider: picked.provider, courierId: picked.id, mode: picked.mode });
    else if (platform !== 'all' && providers.byId[platform]?.configured) body.provider = platform; // no rates: let that platform choose
    else if (providers.configured[0]) body.provider = providers.configured[0].id; // rates unavailable: let the platform choose
    else return toast.error('No courier is connected');
    setBooking(true);
    try {
      const res = await api.post(`/shipping/orders/${id}/book`, body);
      const r = res.result;
      toast.success(r.awb ? `Shipped with ${r.courierName || r.providerLabel}. AWB ${r.awb}` : `Booked with ${r.providerLabel}. The AWB arrives shortly`);
      router.push(`/orders/${id}`);
    } catch (err) {
      toast.error(err.message);
      setBooking(false);
    }
  };

  if (loading || !order) return <Spinner />;
  if (order.shipping?.status === 'booked') {
    return (<p className="rounded-2xl bg-surface p-6 text-sm">This order is already shipped. <Link className="font-medium text-primary underline" href={`/orders/${id}`}>Open the order</Link></p>);
  }
  if (order.status !== 'confirmed') {
    return (
      <p className="rounded-2xl bg-surface p-6 text-sm">
        {['new_order', 'agent_assigned'].includes(order.status) ? 'This order is not confirmed yet. Confirm it first, then ship it.' : 'Only a confirmed order can be shipped.'}{' '}
        <Link className="font-medium text-primary underline" href={`/orders/${id}`}>Open the order</Link>
      </p>
    );
  }
  const cod = order.payment?.type === 'COD';

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[28px] font-semibold tracking-tight">Ship Order <span className="num">{order.orderId}</span></h1>
        <div className="flex items-center gap-3">
          <Link href="/orders" className="px-3 py-2 text-sm font-semibold text-muted hover:text-foreground">Cancel</Link>
          <Button icon={Truck} loading={booking} disabled={Boolean(missing.length) || !origin} onClick={ship}>Ship Now</Button>
        </div>
      </div>

      {missing.length > 0 && (
        <p className="mb-6 flex items-center gap-2 rounded-2xl bg-warning-soft p-4 text-sm text-warning">
          <TriangleAlert className="h-4 w-4" /> Customer {missing.join(' and ')} missing. Couriers need it.
          <Link href="/customers" className="font-semibold underline">Open Customers</Link> (the pincode fills state and city)
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
        <aside className="space-y-6 lg:pr-4">
          <Fact label="Order"><p className="num text-lg font-semibold">{order.orderId}</p><p className="mt-1 text-sm text-muted">Forward · Single</p></Fact>
          <Fact label="Route">
            <div className="flex items-center justify-between gap-2">
              <div><p className="font-semibold">{origin?.city || '-'}</p><p className="num text-xs text-muted">{origin?.pincode || ''}</p></div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
              <div className="text-right"><p className="font-semibold uppercase">{c.city || '-'}</p><p className="num text-xs text-muted">{c.pincode || ''}</p></div>
            </div>
            <div className="mt-3">
              <Select placeholder={wh.loading ? 'Loading...' : 'Select pickup warehouse'} options={wh.options} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}
                hint={!wh.loading && !wh.options.length ? <Link href="/shipping/warehouses" className="text-primary underline">Add a warehouse first</Link> : undefined} />
            </div>
          </Fact>
          <Fact label="Order value"><p className="num text-xl font-semibold">{currency(order.totalAmount)}</p><p className="mt-0.5 text-xs text-muted">{order.taxInclusive ? `incl. GST ${order.gstRate ?? 5}%` : `with GST ${order.gstRate ?? 5}%`}</p></Fact>
          <Fact label="Payment"><p className="text-sm font-semibold">{cod ? `COD · ${currency(order.payment.codAmount || order.totalAmount)}` : 'Prepaid'}</p></Fact>
          <Fact label="Order bill"><p className="num text-xl font-semibold">{picked && Number.isFinite(Number(picked.rate)) ? currency(picked.rate) : '-'}</p>
            {choice === 'auto' && picked && <p className="mt-0.5 text-xs text-muted">Auto: {picked.name}</p>}</Fact>
          <Fact label="Applicable weight (in kg)"><p className="num text-xl font-semibold">{weightKg ? `${weightKg.toFixed(2)} kg` : '-'}</p>
            <p className="mt-0.5 text-xs text-muted">Dead {dead.toFixed(2)} kg · Volumetric {volumetric.toFixed(2)} kg</p></Fact>
          {providers.byId.xpressbees?.configured && (
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" checked={autoPickup} onChange={(e) => setAutoPickup(e.target.checked)} /> Request pickup automatically</label>
          )}
          <Link href={`/orders/${id}/edit`} className="block text-sm font-medium text-primary hover:underline">Edit order details</Link>
        </aside>

        <section>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl border border-border bg-surface p-1 shadow-card">
                {[['all', 'All', all.length], ['surface', 'Surface', count((x) => x.mode === 'surface')], ['air', 'Air', count((x) => x.mode === 'air')]].map(([v, label, n]) => (
                  <button key={v} onClick={() => setMode(v)} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${mode === v ? 'bg-primary-soft text-primary' : 'text-muted hover:text-foreground'}`}>
                    {label} <span className="num ml-1 rounded-full bg-surface-muted px-1.5 py-0.5 text-xs">{n}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted"><b className="num text-foreground">{visible.length}</b> services found</span>
              <Button variant="secondary" size="sm" icon={RefreshCw} loading={fetching} onClick={loadRates} aria-label="Refresh rates" />
            </div>
          </div>

          <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Courier platform">
            {[{ id: 'all', label: 'All platforms', n: all.length }, ...PROVIDER_ORDER.map((p) => ({ id: p, label: PROVIDER_LABEL[p], n: all.filter((x) => x.provider === p).length }))].map((b) => {
              const connected = b.id === 'all' || providers.byId[b.id]?.configured;
              const g = (groups || []).find((x) => x.provider === b.id);
              const on = platform === b.id;
              return (
                <button key={b.id} type="button" disabled={!connected} onClick={() => { setPlatform(b.id); setChoice('auto'); }} aria-pressed={on}
                  title={connected ? undefined : `${b.label} is not connected. Add its keys in backend/.env`}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${on ? 'border-primary bg-primary text-primary-foreground shadow-glow' : connected ? 'border-border bg-surface text-foreground shadow-card hover:border-primary/50' : 'cursor-not-allowed border-dashed border-border bg-surface-muted text-muted/60'}`}>
                  {b.label}
                  {connected && (g?.loading
                    ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent opacity-60" />
                    : <span className={`num rounded-full px-1.5 py-0.5 text-[11px] ${on ? 'bg-white/25' : g?.error ? 'bg-danger-soft text-danger' : 'bg-surface-muted text-muted'}`}>{g?.error ? '!' : b.n}</span>)}
                </button>
              );
            })}
          </div>

          {errors.length > 0 && (
            <div className="mb-4 space-y-1 rounded-2xl bg-warning-soft p-4 text-sm text-warning">
              {errors.map((g) => <p key={g.provider}><b>{g.label}:</b> {g.error}</p>)}
            </div>
          )}

          <div className="mb-3 grid grid-cols-[28px_1fr_120px_130px] gap-4 px-5">
            <span /><span className="eyebrow">Courier service</span><span className="eyebrow text-center">Weight</span><span className="eyebrow text-right">Charges</span>
          </div>

          <div className="space-y-3">
            <button
              type="button" onClick={() => setChoice('auto')}
              className={`grid w-full grid-cols-[28px_1fr_120px_130px] items-center gap-4 rounded-2xl border p-5 text-left transition ${choice === 'auto' ? 'border-primary bg-primary-soft ring-1 ring-primary/30' : 'border-border bg-surface shadow-card hover:border-primary/50'}`}
            >
              <span className={`flex h-6 w-6 items-center justify-center rounded-md border-2 ${choice === 'auto' ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>{choice === 'auto' && <Sparkles className="h-3.5 w-3.5" />}</span>
              <span><span className="block text-[15px] font-semibold">Auto Allocate</span><span className="mt-1 block text-xs text-foreground/80">System will automatically assign the best courier based on rate and rating</span></span>
              <span className="num rounded-lg border border-border bg-surface px-3 py-2 text-center text-sm font-semibold">{weightKg.toFixed(2)} K.G</span>
              <span className="text-right"><span className="block text-base font-bold tracking-wide">Best Rate</span>{recommended && <span className="num block text-[11px] text-muted">{recommended.name}</span>}</span>
            </button>

            {fetching && !all.length && <Spinner label="Fetching rates from your couriers..." />}
            {!fetching && groups && !visible.length && !errors.length && (
              <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">No courier delivers on this route{platform !== 'all' ? ` on ${PROVIDER_LABEL[platform]}` : ''}. Try another platform or pickup warehouse.</p>
            )}
            {visible.map((x) => (
              <CourierOption key={`${x.provider}:${x.id}`} c={x} platform={x.platform} weightKg={weightKg}
                selected={choice === `${x.provider}:${x.id}`} onSelect={() => setChoice(`${x.provider}:${x.id}`)} />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

export default function ShipOrderPage() {
  return (<RoleGuard roles={['admin']}><ShipOrder /></RoleGuard>);
}
