'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Plus, RefreshCw, Download as DownloadIcon, RotateCcw, Upload, UserPlus, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import useList from '@/hooks/useList';
import useOptions from '@/hooks/useOptions';
import usePolling from '@/hooks/usePolling';
import useWarehouses from '@/hooks/useWarehouses';
import { ORDER_TABS, canCreateOrders, isAdminRole } from '@/lib/constants';
import { downloadCsv } from '@/lib/csv';
import RoleGuard from '@/components/layout/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Tabs from '@/components/ui/Tabs';
import Pagination from '@/components/ui/Pagination';
import LiveBadge from '@/components/common/LiveBadge';
import OrdersTable from '@/components/orders/OrdersTable';
import OrderStatCards from '@/components/orders/OrderStatCards';
import OrdersFilters, { DATE_PRESETS } from '@/components/orders/OrdersFilters';
import BulkResultModal from '@/components/orders/BulkResultModal';
import BulkAssignModal from '@/components/orders/BulkAssignModal';
import NdrBulkModal from '@/components/shipping/NdrBulkModal';

const REFRESH_MS = 20000;
const CSV_HEAD = ['Order ID', 'Date', 'Customer', 'Mobile', 'City', 'State', 'Pincode', 'Items', 'Payment', 'Amount (with GST)', 'Status', 'Agent', 'Courier', 'AWB'];
const csvRow = (o) => [
  o.orderId, new Date(o.orderDate).toLocaleDateString('en-IN'), o.customer?.name, o.customer?.mobile, o.customer?.city, o.customer?.state, o.customer?.pincode,
  o.items.map((i) => `${i.name} x${i.quantity}`).join('; '), o.payment?.type, o.totalAmount, o.status, o.agent?.name, o.shipping?.courierName, o.shipping?.awb || o.courier?.awb,
];

function OrdersPage() {
  const { user } = useAuth();
  const role = user.role;
  const admin = isAdminRole(role);
  const isAgent = role === 'agent';
  const isNdr = role === 'ndr';
  const ndrTeam = admin || isNdr || isAgent; // an agent works NDR on their own orders only (the API enforces it)
  const router = useRouter();
  const urlSearch = useSearchParams().get('search') || '';
  // The NDR team lands on the failed deliveries; everybody else on orders waiting for confirmation
  const list = useList('/orders', { tab: urlSearch ? '' : isNdr ? 'ndr' : 'pending', search: urlSearch, searchBy: 'all' }, 25, { refreshMs: REFRESH_MS });
  const agents = useOptions(admin ? '/users' : null, { role: 'agent' });
  const wh = useWarehouses();
  const [counts, setCounts] = useState({});
  const [syncing, setSyncing] = useState(false);
  const [datePreset, setDatePreset] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [report, setReport] = useState(null); // { title, ...result } of the last bulk action
  const [ndrOrders, setNdrOrders] = useState(null);
  const [assignOpen, setAssignOpen] = useState(false);

  const loadCounts = useCallback(() => api.get('/orders/counts').then(setCounts).catch(() => {}), []);
  useEffect(() => { loadCounts(); }, [loadCounts]);
  usePolling(loadCounts, REFRESH_MS);
  // A search from the header looks through every tab (the default tab alone would hide the result)
  useEffect(() => {
    list.setParam('search', urlSearch);
    if (urlSearch) { list.setParam('tab', ''); list.setParam('status', ''); }
  }, [urlSearch]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSelected(new Set()); }, [list.params.tab, list.params.page]);

  const tabs = useMemo(() => ORDER_TABS.map((t) => ({ ...t, count: counts[t.value === '' ? 'all' : t.value] ?? 0 })), [counts]);
  const changed = () => { list.reload({ silent: true }); loadCounts(); setSelected(new Set()); };
  const selectedRows = list.rows.filter((r) => selected.has(r._id));

  const pickDate = (key) => {
    setDatePreset(key);
    const r = DATE_PRESETS.find((d) => d.key === key)?.range() || { from: '', to: '' };
    list.setParam('from', r.from);
    list.setParam('to', r.to);
  };
  const pickRange = (from, to) => { setDatePreset(''); list.setParam('from', from); list.setParam('to', to); };
  // A status filter and a tab would fight each other, so picking a status shows "All"
  const setFilter = (key, value) => { if (key === 'status' && value) list.setParam('tab', ''); list.setParam(key, value); };
  const setTab = (tab) => { if (tab) list.setParam('status', ''); list.setParam('tab', tab); };
  const clearAll = () => {
    setDatePreset('');
    ['search', 'from', 'to', 'status', 'warehouse', 'transport', 'payment', 'agent', 'provider'].forEach((k) => list.setParam(k, ''));
    if (urlSearch) router.replace('/orders');
    list.setParam('searchBy', 'all');
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      const r = await api.post('/shipping/sync');
      toast.success(r.checked ? `Checked ${r.checked} shipment(s), ${r.updated} updated` : 'No open shipments to check');
      changed();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSyncing(false);
    }
  };

  // Export every order that matches the current filters (not just the first page)
  const exportCsv = async () => {
    try {
      const all = [];
      for (let page = 1; page <= 50; page += 1) {
        const res = await api.get('/orders', { ...list.params, page, limit: 100 });
        all.push(...res.data);
        if (page >= res.meta.pages) break;
      }
      downloadCsv(`orders-${new Date().toISOString().slice(0, 10)}.csv`, CSV_HEAD, all.map(csvRow));
      toast.success(`Exported ${all.length} order(s)`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const runBulk = async (path, title, body = {}) => {
    try {
      const res = await api.post(path, { ids: [...selected], ...body });
      setReport({ title, ...res });
    } catch (err) {
      toast.error(err.message);
    }
    changed();
  };
  const confirmSelected = () => runBulk('/orders/bulk/confirm', 'Confirm orders');
  const cancelSelected = () => {
    if (!window.confirm(`Cancel ${selected.size} order(s)? Shipments are cancelled with the courier and stock goes back to inventory.`)) return;
    runBulk('/orders/bulk/cancel', 'Cancel orders');
  };

  const bulk = [
    ...(canCreateOrders(role) ? [{ label: 'Confirm selected orders', icon: CheckCircle2, onClick: confirmSelected }] : []),
    ...(admin ? [{ label: 'Assign to agent', icon: UserPlus, onClick: () => setAssignOpen(true) }] : []),
    ...(ndrTeam ? [{ label: 'NDR action on selected', icon: RotateCcw, onClick: () => setNdrOrders(selectedRows) }] : []),
    { label: 'Export selected as CSV', icon: DownloadIcon, onClick: () => downloadCsv('selected-orders.csv', CSV_HEAD, selectedRows.map(csvRow)) },
    ...(admin ? [{ label: 'Cancel selected orders', icon: XCircle, danger: true, onClick: cancelSelected }] : []),
  ];

  const description = isAgent ? 'Your orders only. Create an order, confirm it, and the admin ships it.'
    : isNdr ? 'All orders. Open the NDR tab to act on failed deliveries, one by one or in bulk.'
      : 'Create orders, confirm them, ship with the best courier and watch the status update live.';

  return (
    <RoleGuard roles={['admin', 'agent', 'ndr']}>
      <PageHeader
        title={isAgent ? 'My orders' : 'Orders'}
        description={description}
        actions={(
          <>
            <LiveBadge updatedAt={list.updatedAt} />
            {(admin || isNdr) && <Button variant="secondary" icon={RefreshCw} loading={syncing} onClick={syncNow}>Sync status</Button>}
            {canCreateOrders(role) && <Link href="/orders/bulk"><Button variant="secondary" icon={Upload}>Bulk upload</Button></Link>}
            {canCreateOrders(role) && <Link href="/orders/new"><Button icon={Plus}>Create order</Button></Link>}
          </>
        )}
      />

      <OrderStatCards counts={counts} active={list.params.tab} onPick={setTab} />

      <Card padded={false} className="mb-5 overflow-hidden">
        <Tabs tabs={tabs} value={list.params.tab ?? ''} onChange={setTab} />
      </Card>

      <OrdersFilters
        params={list.params} setParam={setFilter} datePreset={datePreset} onDatePreset={pickDate} onDateRange={pickRange} onClear={clearAll} onExport={exportCsv}
        warehouses={wh.options} agents={agents} selected={selected.size} bulk={bulk} canFilterMore={admin || isNdr}
      />

      <p className="mb-3 text-right text-sm font-semibold text-foreground"><span className="num">{list.meta.total || 0}</span> orders</p>
      <Card padded={false} className="overflow-hidden">
        <OrdersTable rows={list.rows} loading={list.loading} selected={selected} setSelected={setSelected} role={role} onChanged={changed} onNdr={setNdrOrders} />
        <Pagination meta={list.meta} onChange={list.setPage} onLimit={(n) => list.setParam('limit', n)} />
      </Card>

      <BulkResultModal title={report?.title} report={report} onClose={() => setReport(null)} />
      <BulkAssignModal open={assignOpen} ids={[...selected]} agents={agents} onClose={() => setAssignOpen(false)}
        onDone={(res) => { setAssignOpen(false); setReport({ title: 'Assign agent', ...res }); changed(); }} />
      <NdrBulkModal open={Boolean(ndrOrders)} orders={ndrOrders || []} onClose={() => setNdrOrders(null)} onDone={changed} />
    </RoleGuard>
  );
}

export default function Page() {
  return <Suspense fallback={null}><OrdersPage /></Suspense>;
}
