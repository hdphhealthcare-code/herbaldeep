'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { todayISO } from '@/lib/format';
import { INVOICE_STATUS } from '@/lib/constants';
import useOptions from '@/hooks/useOptions';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Select, Input, Textarea } from '@/components/ui/FormField';
import InvoiceLinesEditor from './InvoiceLinesEditor';
import InvoiceTotals, { computeTotals } from './InvoiceTotals';

export default function InvoiceForm() {
  const router = useRouter();
  const preselected = useSearchParams().get('order') || '';
  const customers = useOptions('/customers');
  const orders = useOptions('/orders', { limit: 100 }, 'orderId');

  const [orderId, setOrderId] = useState(preselected);
  const [customer, setCustomer] = useState('');
  const [lines, setLines] = useState([{ name: '', quantity: 1, rate: '' }]);
  const [discount, setDiscount] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [status, setStatus] = useState('generated');
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  // Selecting an order pre-fills customer and line items from it
  useEffect(() => {
    const order = orders.find((o) => o.value === orderId)?.raw;
    if (!order) return;
    setCustomer(order.customer?._id || '');
    api.get(`/orders/${orderId}`).then((full) => {
      setLines(full.items.map((i) => ({ name: i.name, quantity: i.quantity, rate: i.price })));
    });
  }, [orderId, orders]);

  const totals = computeTotals(lines, discount, taxPercent);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const inv = await api.post('/invoices', {
        order: orderId || undefined, customer, lines: lines.map((l) => ({ ...l, quantity: Number(l.quantity), rate: Number(l.rate) })),
        discount: Number(discount), taxPercent: Number(taxPercent), status, invoiceDate, remarks,
      });
      toast.success(`Invoice ${inv.invoiceNo} created`);
      router.push(`/invoices/${inv._id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card title="Invoice for">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Order (optional)" placeholder="Select order" options={orders} value={orderId} onChange={(e) => setOrderId(e.target.value)} />
          <Select label="Customer" required placeholder="Select customer" options={customers} value={customer} onChange={(e) => setCustomer(e.target.value)} />
          <Input label="Invoice date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          <Select label="Status" options={INVOICE_STATUS} value={status} onChange={(e) => setStatus(e.target.value)} />
        </div>
      </Card>
      <Card title="Items">
        <InvoiceLinesEditor lines={lines} onChange={setLines} />
      </Card>
      <Card title="Charges & remarks">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Discount (INR)" type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          <Input label="Tax / GST (%)" type="number" min="0" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} />
          <Textarea wrapperClass="sm:col-span-2" label="Remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>
        <div className="mt-5"><InvoiceTotals {...totals} discount={discount} taxPercent={taxPercent} /></div>
      </Card>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" loading={saving}>Generate invoice</Button>
      </div>
    </form>
  );
}
