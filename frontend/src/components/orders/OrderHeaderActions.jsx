'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Copy, FilePlus2, FileText, Pencil, RotateCcw, Truck, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { CANCELLABLE_STATUS, EDITABLE_STATUS, PRE_CONFIRM_STATUS, canCreateOrders, isAdminRole } from '@/lib/constants';
import Button from '@/components/ui/Button';
import NdrBulkModal from '@/components/shipping/NdrBulkModal';

const INVOICEABLE = ['ready_for_dispatch', 'in_transit', 'out_for_delivery', 'ndr', 'delivered'];

/**
 * The buttons at the top of an order. What a person sees depends on their role:
 *   agent  -> Confirm, Edit (until confirmed), Clone                         (never Ship)
 *   admin  -> Confirm, Ship now (after confirmation), Edit, Clone, Invoice, Cancel
 *   ndr    -> NDR action (re-attempt) when the delivery failed
 */
export default function OrderHeaderActions({ order, invoice, role, onUpdated }) {
  const [busy, setBusy] = useState('');
  const [ndrOpen, setNdrOpen] = useState(false);
  const admin = isAdminRole(role);
  const creator = canCreateOrders(role);
  const booked = order.shipping?.status === 'booked';
  const pending = PRE_CONFIRM_STATUS.includes(order.status);
  const editable = creator && !booked && (admin ? EDITABLE_STATUS.includes(order.status) : pending);

  const run = async (key, fn, okMsg) => {
    setBusy(key);
    try {
      onUpdated(await fn());
      toast.success(okMsg);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  };

  const confirm = () => run('confirm', () => api.post(`/orders/${order._id}/confirm`, {}), 'Order confirmed');
  const cancel = () => {
    const ok = window.confirm(`Cancel order ${order.orderId}?${booked ? '\n\nThe shipment will be cancelled with the courier too.' : ''}\n\nReserved stock goes back to inventory.`);
    if (ok) run('cancel', () => api.post(`/orders/${order._id}/cancel`, {}), 'Order cancelled');
  };

  return (
    <>
      {creator && pending && <Button icon={CheckCircle2} loading={busy === 'confirm'} onClick={confirm}>Confirm order</Button>}
      {admin && !booked && order.status === 'confirmed' && <Link href={`/orders/${order._id}/ship`}><Button icon={Truck}>Ship now</Button></Link>}
      {(admin || role === 'ndr' || role === 'agent') && order.status === 'ndr' && booked && order.shipping?.awb && (
        <Button variant="secondary" icon={RotateCcw} onClick={() => setNdrOpen(true)}>NDR action</Button>
      )}
      {editable && <Link href={`/orders/${order._id}/edit`}><Button variant="secondary" icon={Pencil}>Edit</Button></Link>}
      {creator && <Link href={`/orders/new?clone=${order._id}`}><Button variant="secondary" icon={Copy}>Clone</Button></Link>}
      {admin && (invoice
        ? <Link href={`/invoices/${invoice._id}`}><Button variant="secondary" icon={FileText}>View {invoice.invoiceNo}</Button></Link>
        : INVOICEABLE.includes(order.status) && <Link href={`/invoices/new?order=${order._id}`}><Button icon={FilePlus2}>Create invoice</Button></Link>)}
      {admin && CANCELLABLE_STATUS.includes(order.status) && (
        <Button variant="danger" icon={XCircle} loading={busy === 'cancel'} onClick={cancel}>Cancel order</Button>
      )}
      <NdrBulkModal open={ndrOpen} orders={[order]} onClose={() => setNdrOpen(false)}
        onDone={async () => { try { onUpdated(await api.get(`/orders/${order._id}`)); } catch { /* the live refresh picks it up */ } }} />
    </>
  );
}
