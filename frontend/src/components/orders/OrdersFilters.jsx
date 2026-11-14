'use client';

import { forwardRef, useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, Download, ListChecks, Search, SlidersHorizontal, X } from 'lucide-react';
import Menu, { MenuItem, MenuLabel } from '@/components/ui/Menu';
import Button from '@/components/ui/Button';

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };
const monthStart = (back = 0) => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() - back, 1); };

// "Last 7 days" = today and the 6 days before it (7 days in all)
export const DATE_PRESETS = [
  { key: 'today', label: 'Today', range: () => ({ from: ymd(new Date()), to: ymd(new Date()) }) },
  { key: 'yesterday', label: 'Yesterday', range: () => ({ from: daysAgo(1), to: daysAgo(1) }) },
  { key: '7', label: 'Last 7 days', range: () => ({ from: daysAgo(6), to: ymd(new Date()) }) },
  { key: '30', label: 'Last 30 days', range: () => ({ from: daysAgo(29), to: ymd(new Date()) }) },
  { key: '90', label: 'Last 90 days', range: () => ({ from: daysAgo(89), to: ymd(new Date()) }) },
  { key: 'month', label: 'This month', range: () => ({ from: ymd(monthStart()), to: ymd(new Date()) }) },
  { key: 'lastmonth', label: 'Last month', range: () => ({ from: ymd(monthStart(1)), to: ymd(new Date(monthStart().getTime() - 86400000)) }) },
];

export const SEARCH_BY = [
  { value: 'all', label: 'All fields', placeholder: 'Order ID, AWB, mobile or customer' },
  { value: 'orderId', label: 'Order ID', placeholder: 'e.g. HBD-00123' },
  { value: 'mobile', label: 'Mobile number', placeholder: '10-digit mobile number' },
  { value: 'awb', label: 'AWB number', placeholder: 'Courier AWB / tracking number' },
  { value: 'name', label: 'Customer name', placeholder: 'Customer name' },
];

// One entry per stage a person thinks in (a comma list is sent to the API as an "any of" filter)
export const STATUS_FILTER = [
  { value: 'new_order,agent_assigned', label: 'Pending confirmation' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'ready_for_dispatch', label: 'Ready for dispatch' },
  { value: 'in_transit', label: 'In transit' },
  { value: 'out_for_delivery', label: 'Out for delivery' },
  { value: 'ndr', label: 'Delivery failed (NDR)' },
  { value: 'delivered,invoice_generated', label: 'Delivered' },
  { value: 'rto,rto_delivered', label: 'RTO' },
  { value: 'cancelled', label: 'Cancelled' },
];

// forwardRef is required: Menu positions itself from this button, and React 18 drops `ref` on plain function components
const Pill = forwardRef(function Pill({ icon: Icon, active, children, ...props }, ref) {
  return (
    <button type="button" ref={ref} {...props}
      className={`flex items-center gap-2 whitespace-nowrap rounded-xl border px-3.5 py-2.5 text-sm transition ${active ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface hover:border-foreground/25'}`}>
      {Icon && <Icon className="h-4 w-4" />}{children}<ChevronDown className="h-3.5 w-3.5 opacity-60" />
    </button>
  );
});

// Search box that waits for a short pause in typing before asking the server (one request instead of one per key)
function SearchInput({ value, onChange, ...props }) {
  const [text, setText] = useState(value || '');
  const timer = useRef(null);
  useEffect(() => { setText(value || ''); }, [value]); // cleared from outside (Clear all, header search)
  const change = (v) => {
    setText(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(v), 350);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return <input {...props} value={text} onChange={(e) => change(e.target.value)}
    onKeyDown={(e) => { if (e.key === 'Enter') { clearTimeout(timer.current); onChange(text); } }} />;
}

// Native select drawn as a pill (Pickup, Transport)
const SelectPill = ({ value, onChange, placeholder, options }) => (
  <label className={`relative flex items-center rounded-xl border text-sm transition ${value ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface hover:border-foreground/25'}`}>
    <select value={value || ''} onChange={(e) => onChange(e.target.value)} className="cursor-pointer appearance-none bg-transparent py-2.5 pl-3.5 pr-9 outline-none">
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3 h-3.5 w-3.5 opacity-60" />
  </label>
);

/**
 * "FILTERS | search | date | Pickup | Transport | More filters | Clear all"  ..........  [export] [bulk action]
 */
export default function OrdersFilters({
  params, setParam, datePreset, onDatePreset, onDateRange, warehouses = [], agents = [], onClear, onExport, selected = 0, bulk = [], canFilterMore = true,
}) {
  const preset = DATE_PRESETS.find((p) => p.key === datePreset);
  const customRange = !preset && (params.from || params.to);
  const more = ['payment', 'agent', 'provider'].filter((k) => params[k]).length;
  const dirty = Boolean(params.search || datePreset || params.from || params.to || params.status || params.warehouse || params.transport || more);
  const by = SEARCH_BY.find((o) => o.value === (params.searchBy || 'all')) || SEARCH_BY[0];

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-card">
      <span className="eyebrow px-2">Filters</span>
      <div className="flex min-w-[300px] flex-1 items-center sm:max-w-lg">
        <select aria-label="Search by" value={params.searchBy || 'all'} onChange={(e) => setParam('searchBy', e.target.value)}
          className="h-[42px] shrink-0 cursor-pointer rounded-l-xl border border-r-0 border-border bg-surface-muted px-3 text-sm outline-none">
          {SEARCH_BY.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <SearchInput className="input-base rounded-l-none pl-10" placeholder={by.placeholder} inputMode={by.value === 'mobile' ? 'numeric' : undefined}
            value={params.search || ''} onChange={(v) => setParam('search', v)} />
        </div>
      </div>

      <Menu width={260} trigger={(p) => <Pill {...p} icon={CalendarDays} active={Boolean(preset || customRange)}>{preset ? preset.label : customRange ? `${params.from || '...'} to ${params.to || '...'}` : 'All time'}</Pill>}>
        {(close) => (
          <>
            <MenuItem close={close} onClick={() => onDatePreset('')}>All time</MenuItem>
            {DATE_PRESETS.map((d) => <MenuItem key={d.key} close={close} onClick={() => onDatePreset(d.key)}>{d.label}</MenuItem>)}
            <div className="space-y-2 border-t border-border p-3">
              <span className="eyebrow block">Custom range</span>
              <label className="block text-xs">From<input type="date" max={params.to || undefined} className="input-base mt-1" value={params.from || ''} onChange={(e) => onDateRange(e.target.value, params.to || '')} /></label>
              <label className="block text-xs">To<input type="date" min={params.from || undefined} className="input-base mt-1" value={params.to || ''} onChange={(e) => onDateRange(params.from || '', e.target.value)} /></label>
            </div>
          </>
        )}
      </Menu>
      {(preset || customRange) && <button onClick={() => onDatePreset('')} className="-ml-2 rounded-full p-1 text-muted hover:bg-surface-muted" aria-label="Clear date"><X className="h-3.5 w-3.5" /></button>}

      <SelectPill placeholder="Status" value={params.status} onChange={(v) => setParam('status', v)} options={STATUS_FILTER} />

      {warehouses.length > 0 && <SelectPill placeholder="Pickup" value={params.warehouse} onChange={(v) => setParam('warehouse', v)} options={warehouses} />}
      <SelectPill placeholder="Transport" value={params.transport} onChange={(v) => setParam('transport', v)}
        options={[{ value: 'surface', label: 'Surface' }, { value: 'air', label: 'Air' }]} />

      {canFilterMore && (
        <Menu width={260} trigger={(p) => <Pill {...p} icon={SlidersHorizontal} active={more > 0}>More filters{more ? ` (${more})` : ''}</Pill>}>
          {() => (
            <div className="space-y-3 p-3">
              {[
                ['payment', 'Payment', [{ value: 'PREPAID', label: 'Prepaid' }, { value: 'COD', label: 'COD' }]],
                ['provider', 'Courier platform', [{ value: 'xpressbees', label: 'Xpressbees' }, { value: 'shipmozo', label: 'Shipmozo' }, { value: 'ekart', label: 'Ekart' }, { value: 'delhivery', label: 'Delhivery' }, { value: 'shiprocket', label: 'Shiprocket' }]],
                ['agent', 'Agent', agents],
              ].map(([key, label, options]) => (
                <label key={key} className="block text-xs">
                  <span className="eyebrow mb-1 block">{label}</span>
                  <select className="input-base" value={params[key] || ''} onChange={(e) => setParam(key, e.target.value)}>
                    <option value="">All</option>
                    {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
              ))}
            </div>
          )}
        </Menu>
      )}

      {dirty && <button onClick={onClear} className="text-sm font-medium text-muted underline-offset-2 hover:text-primary hover:underline">Clear all</button>}

      <div className="ml-auto flex items-center gap-2">
        <Button variant="secondary" icon={Download} onClick={onExport} aria-label="Export CSV" title="Export the filtered orders as CSV" />
        <Menu width={230} trigger={(p) => <Pill {...p} icon={ListChecks} active={selected > 0}>{selected ? `${selected} selected` : 'Select bulk action'}</Pill>}>
          {(close) => (
            <>
              <MenuLabel>{selected ? `${selected} order(s) selected` : 'Tick orders first'}</MenuLabel>
              {bulk.map((b) => <MenuItem key={b.label} close={close} icon={b.icon} danger={b.danger} disabled={!selected} onClick={b.onClick}>{b.label}</MenuItem>)}
            </>
          )}
        </Menu>
      </div>
    </div>
  );
}
