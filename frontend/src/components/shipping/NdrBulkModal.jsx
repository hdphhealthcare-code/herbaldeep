'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PROVIDER_LABEL } from '@/lib/shipping';
import useProviders from '@/hooks/useProviders';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/FormField';

const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

/**
 * NDR action for one or many orders, any courier platform: re-attempt delivery (date, optional new phone / address)
 * or return to origin (only where the courier takes it). Every order is sent on its own, so the result lists which
 * went through and which did not (and why). Orders can come from the orders table (`orders`) or the NDR page.
 */
export default function NdrBulkModal({ open, orders = [], onClose, onDone }) {
  const providers = useProviders();
  const [f, setF] = useState({ action: 'Re-Attempt', date: day(1), phone: '', address: '', instructions: '' });
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);
  const single = orders.length === 1;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => { if (open) { setReport(null); setF({ action: 'Re-Attempt', date: day(1), phone: '', address: '', instructions: '' }); } }, [open]);

  const providerOf = (o) => o.shipping?.provider || o.provider || 'xpressbees';
  const rtoOk = orders.length > 0 && orders.every((o) => providers.byId[providerOf(o)]?.capabilities?.ndrRto);
  const noApi = orders.filter((o) => providerOf(o) === 'shipmozo'); // Shipmozo publishes no NDR API
  const reattempt = f.action === 'Re-Attempt';

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post('/shipping/orders/bulk-ndr', {
        ids: orders.map((o) => o._id), action: f.action, date: reattempt ? f.date : undefined, instructions: f.instructions || undefined,
        ...(single && reattempt ? { phone: f.phone || undefined, address: f.address || undefined } : {}),
      });
      setReport(res);
      if (res.ok) toast.success(`${reattempt ? 'Re-attempt' : 'Return'} requested for ${res.ok} order(s)`);
      if (res.failed) toast.error(`${res.failed} order(s) could not be sent`);
      onDone?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const title = single ? `NDR action · ${orders[0].orderId}` : `NDR action · ${orders.length} orders`;
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={report
        ? <Button onClick={onClose}>Close</Button>
        : (<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="ndr-bulk-form" loading={busy}>{reattempt ? 'Request re-attempt' : 'Request return'}</Button></>)}>
      {report ? (
        <ul className="space-y-2 text-sm">
          {report.results.map((r) => (
            <li key={r.id} className="flex items-start gap-2">
              {r.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />}
              <span><b className="num">{r.orderId}</b>{r.ok ? ' sent to the courier' : <span className="text-danger"> {r.message}</span>}</span>
            </li>
          ))}
        </ul>
      ) : (
        <form id="ndr-bulk-form" onSubmit={submit} className="space-y-4">
          {single && (
            <p className="rounded-lg bg-surface-muted p-3 text-sm">
              {PROVIDER_LABEL[providerOf(orders[0])]}{orders[0].shipping?.lastTrackStatus ? <> says: <b>{orders[0].shipping.lastTrackStatus}</b></> : ''}
            </p>
          )}
          {noApi.length > 0 && (
            <p className="rounded-lg bg-warning-soft p-3 text-xs text-warning">
              Shipmozo has no NDR API, so {noApi.length === orders.length ? 'this request cannot be sent from the CRM. Ask for the re-attempt in the Shipmozo panel.' : `${noApi.length} selected order(s) will be skipped. Ask for those in the Shipmozo panel.`}
            </p>
          )}
          {rtoOk && (
            <Select label="Action" value={f.action} onChange={set('action')}
              options={[{ value: 'Re-Attempt', label: 'Re-attempt delivery' }, { value: 'RTO', label: 'Return to origin (RTO)' }]} />
          )}
          {reattempt && <Input label="Re-attempt date" type="date" required min={day(1)} max={day(7)} value={f.date} onChange={set('date')} hint="Within the next 7 days, not today" />}
          {reattempt && single && (
            <>
              <Input label="Updated phone (optional)" inputMode="numeric" maxLength={10} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, '') })} />
              <Textarea label="Updated address (optional)" rows={2} value={f.address} onChange={set('address')} />
            </>
          )}
          <Textarea label="Instructions for the courier (optional)" rows={2} value={f.instructions} onChange={set('instructions')} />
          {!single && <p className="text-xs text-muted">The same request goes to every selected order. Orders that are not in NDR are skipped and listed afterwards.</p>}
        </form>
      )}
    </Modal>
  );
}
