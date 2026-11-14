'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { todayISO } from '@/lib/format';
import { priceLines } from '@/lib/pricing';
import useOptions from '@/hooks/useOptions';
import useWarehouses from '@/hooks/useWarehouses';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Select, Input, Textarea } from '@/components/ui/FormField';
import CustomerSearch from './CustomerSearch';
import NewCustomerFields from './NewCustomerFields';
import OrderItemsEditor from './OrderItemsEditor';
import PriceBreakdown from './PriceBreakdown';

const EMPTY_CUSTOMER = { name: '', mobile: '', pincode: '', city: '', state: '', area: '', address: '' };
const PAYMENT = [{ value: 'PREPAID', label: 'Prepaid' }, { value: 'COD', label: 'Cash on delivery (COD)' }];
const STEPS = ['Order & customer', 'Products & package'];

/**
 * Two-step order form, used to create, edit and clone:
 *   1. order details + GST number + customer (the pincode fills state and city)  ->  2. products (price includes 5% GST, flat discount), package, payment
 * mode 'create' | 'edit' | 'clone'; `order` is the order being edited or copied.
 * The courier is picked afterwards with "Ship now"; the status then follows the courier by itself.
 */
export default function OrderWizard({ mode = 'create', order = null }) {
  const router = useRouter();
  const { user } = useAuth();
  const isAgent = user.role === 'agent'; // an agent's order is always their own; they pick from the customers THEY added (or add a new one)
  const editing = mode === 'edit';
  const products = useOptions('/products', { isActive: true });
  const agents = useOptions(isAgent ? null : '/users', { role: 'agent', isActive: true });
  const wh = useWarehouses();

  const [step, setStep] = useState(0);
  const [custMode, setCustMode] = useState('existing');
  const [picked, setPicked] = useState(order?.customer || null);
  const [customer, setCustomer] = useState(EMPTY_CUSTOMER);
  const [form, setForm] = useState({
    orderDate: editing && order ? new Date(order.orderDate).toISOString().slice(0, 10) : todayISO(),
    paymentType: order?.payment?.type || 'PREPAID',
    warehouseId: order?.warehouse?._id || '',
    agentId: '',
    notes: order?.notes || '',
    gstNumber: order?.gstNumber || '',
    codAmount: order?.payment?.type === 'COD' ? order.payment.codAmount || '' : '',
  });
  const [parcel, setParcel] = useState({
    weight: order?.parcel?.weight || 500, length: order?.parcel?.length || 10, width: order?.parcel?.width || 10, height: order?.parcel?.height || 10,
  });
  const [items, setItems] = useState(order
    ? order.items.map((i) => ({ product: String(i.product), quantity: i.quantity, discount: i.discount || '' }))
    : [{ product: '', quantity: 1, discount: '' }]);
  const [saving, setSaving] = useState(false);
  // An edit keeps the price the customer was quoted (orders from before v3.4 had prices without GST, so they take today's catalogue price)
  const keepPrices = editing && order?.taxInclusive ? Object.fromEntries(order.items.map((i) => [String(i.product), i.price])) : {};

  useEffect(() => {
    if (!form.warehouseId && wh.defaultId) setForm((o) => ({ ...o, warehouseId: wh.defaultId }));
  }, [wh.defaultId, form.warehouseId]);

  const calc = priceLines(items.map((it) => ({
    price: keepPrices[it.product] ?? products.find((p) => p.value === it.product)?.raw.price ?? 0, quantity: it.quantity, discount: it.discount,
  })));
  const cod = form.paymentType === 'COD';
  const setF = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setP = (k) => (e) => setParcel({ ...parcel, [k]: e.target.value });

  const customerOk = custMode === 'existing'
    ? Boolean(picked)
    : ['name', 'mobile', 'address', 'city', 'state'].every((k) => String(customer[k]).trim()) && /^\d{6}$/.test(customer.pincode) && customer.mobile.length === 10;

  const next = (e) => {
    e.preventDefault();
    if (!customerOk) return toast.error(custMode === 'existing' ? 'Select a customer' : 'Fill every customer field, with a 6-digit pincode and 10-digit mobile');
    setStep(1);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (items.some((i) => !i.product)) return toast.error('Select a product for every row');
    if (form.gstNumber.trim() && !/^\d{2}[A-Za-z]{5}\d{4}[A-Za-z][1-9A-Za-z]Z[0-9A-Za-z]$/.test(form.gstNumber.replace(/\s/g, ''))) return toast.error('GST number must be a valid 15-character GSTIN, for example 24ABCDE1234F1Z5');
    if (calc.lines.some((l) => l.tooMuch)) return toast.error('A discount is more than its item amount');
    setSaving(true);
    try {
      const body = {
        ...(custMode === 'existing' ? { customerId: picked._id } : { customer }),
        items: items.map((i) => ({ product: i.product, quantity: Number(i.quantity), discount: Number(i.discount || 0) })),
        orderDate: form.orderDate,
        notes: form.notes,
        gstNumber: form.gstNumber.trim() || undefined,
        warehouseId: form.warehouseId || undefined,
        payment: { type: form.paymentType, codAmount: cod ? Number(form.codAmount || calc.totalAmount) : 0 },
        parcel: { weight: Number(parcel.weight), length: Number(parcel.length), width: Number(parcel.width), height: Number(parcel.height) },
        ...(editing || isAgent ? {} : { agentId: form.agentId || undefined }),
      };
      const saved = editing ? await api.put(`/orders/${order._id}`, body) : await api.post('/orders', body);
      toast.success(editing ? `Order ${saved.orderId} updated` : `Order ${saved.orderId} created. Confirm it so it can be shipped`);
      router.push(editing ? `/orders/${saved._id}` : '/orders');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const who = custMode === 'existing' ? picked : customer;

  return (
    <div className="space-y-6">
      <ol className="flex items-center gap-3 text-sm">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-3">
            <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
              i < step ? 'bg-success text-primary-foreground' : i === step ? 'bg-primary text-primary-foreground shadow-glow' : 'bg-surface-muted text-muted'}`}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span className={i === step ? 'font-semibold' : 'text-muted'}>{label}</span>
            {i < STEPS.length - 1 && <span className="h-px w-12 bg-border" />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <form onSubmit={next} className="space-y-6">
          <Card title="Order details">
            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="Order date" type="date" required value={form.orderDate} onChange={setF('orderDate')} />
              <Select label="Payment mode" options={PAYMENT} value={form.paymentType} onChange={setF('paymentType')} />
              <Select label="Pickup warehouse" placeholder={wh.loading ? 'Loading...' : 'Select warehouse'} options={wh.options}
                value={form.warehouseId} onChange={setF('warehouseId')}
                hint={!wh.loading && !wh.options.length ? 'No warehouse yet. Add one under Shipping > Warehouses' : undefined} />
              <Input label="GST number (optional)" maxLength={15} placeholder="24ABCDE1234F1Z5" value={form.gstNumber} className="num uppercase"
                onChange={(e) => setForm({ ...form, gstNumber: e.target.value.toUpperCase().replace(/\s/g, '') })}
                hint="15-character GSTIN of the buyer. Printed on the label" wrapperClass="sm:col-span-3 sm:max-w-sm" />
            </div>
          </Card>

          <Card title="Customer details">
            <div className="space-y-4">
              <div className="inline-flex rounded-xl border border-border bg-surface-muted p-1 text-sm">
                {[['existing', isAgent ? 'My customers' : 'Existing customer'], ['new', 'New customer']].map(([value, label]) => (
                  <button type="button" key={value} onClick={() => setCustMode(value)}
                    className={`rounded-lg px-4 py-1.5 font-medium transition ${custMode === value ? 'bg-surface text-foreground shadow-card' : 'text-muted hover:text-foreground'}`}>
                    {label}
                  </button>
                ))}
              </div>
              {custMode === 'existing'
                ? <CustomerSearch value={picked} onChange={setPicked} mineOnly={isAgent} />
                : <NewCustomerFields customer={customer} setCustomer={setCustomer} />}
            </div>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit">Next: add products <ArrowRight className="h-4 w-4" /></Button>
          </div>
        </form>
      )}

      {step === 1 && (
        <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card title="Select products" action={<span className="rounded-md bg-success-soft px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-success">Price includes 5% GST</span>}>
              <OrderItemsEditor items={items} onChange={setItems} products={products} keepPrices={keepPrices} />
              <p className="mt-4 text-xs text-muted">Product prices already include 5% GST. The discount is a flat amount in rupees. The GST contained in the total is shown in the order summary; nothing is added on top.</p>
            </Card>
            <Card title="Package details">
              <div className="grid gap-4 sm:grid-cols-4">
                <Input label="Weight (grams)" type="number" min="1" required value={parcel.weight} onChange={setP('weight')} />
                <Input label="Length (cm)" type="number" min="1" required value={parcel.length} onChange={setP('length')} />
                <Input label="Width (cm)" type="number" min="1" required value={parcel.width} onChange={setP('width')} />
                <Input label="Height (cm)" type="number" min="1" required value={parcel.height} onChange={setP('height')} />
              </div>
            </Card>
            <Card title={editing ? 'Payment & notes' : 'Assignment, payment & notes'}>
              <div className="grid gap-4 sm:grid-cols-2">
                {!editing && isAgent && <p className="rounded-lg bg-surface-muted p-3 text-sm sm:col-span-2">This order will be created under your name. After saving, <b>confirm</b> it so an admin can ship it.</p>}
                {!editing && !isAgent && (
                  <Select label="Assign agent (optional)" placeholder="Assign later" options={agents} value={form.agentId} onChange={setF('agentId')}
                    hint="An agent can be assigned once and changed once. After that it is locked." />
                )}
                {cod && (
                  <Input label="COD amount to collect (INR)" type="number" min="0" value={form.codAmount} placeholder={String(calc.totalAmount)} onChange={setF('codAmount')}
                    hint="Leave empty to collect the full total" />
                )}
                <Textarea wrapperClass="sm:col-span-2" label="Notes" rows={2} value={form.notes} onChange={setF('notes')} />
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Order summary">
              <div className="mb-4 space-y-1 text-sm">
                <p className="eyebrow">Customer</p>
                <p className="font-semibold">{who?.name} <span className="num font-normal text-muted">· {who?.mobile}</span></p>
                <p className="text-muted">{[who?.city, who?.state, who?.pincode].filter(Boolean).join(', ')}</p>
                <p className="pt-1 text-xs text-muted">{cod ? 'Cash on delivery' : 'Prepaid'}</p>
              </div>
              <div className="border-t border-border pt-4">
                <PriceBreakdown subtotal={calc.subtotal} discountTotal={calc.discountTotal} gstAmount={calc.gstAmount} totalAmount={calc.totalAmount} taxableAmount={calc.taxableAmount} inclusive />
              </div>
              <p className="mt-4 text-xs text-muted">After saving, <b>confirm</b> the order. Once it is confirmed an admin ships it, and the status then updates live.</p>
            </Card>
            <div className="flex justify-between gap-2">
              <Button type="button" variant="secondary" icon={ArrowLeft} onClick={() => setStep(0)}>Back</Button>
              <Button type="submit" loading={saving}>{editing ? 'Save changes' : 'Create order'}</Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
