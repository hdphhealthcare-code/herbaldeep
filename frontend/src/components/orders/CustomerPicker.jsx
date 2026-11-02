'use client';

import { Select, Input, Textarea } from '@/components/ui/FormField';

// mode: 'existing' | 'new'. `customer` holds the new-customer fields.
export default function CustomerPicker({ mode, setMode, customerId, setCustomerId, customer, setCustomer, customers }) {
  const set = (k, v) => setCustomer({ ...customer, [k]: v });
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-border p-0.5 text-sm">
        {[['existing', 'Existing customer'], ['new', 'New customer']].map(([value, label]) => (
          <button
            type="button" key={value} onClick={() => setMode(value)}
            className={`rounded-md px-3 py-1.5 transition ${mode === value ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-foreground'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'existing' ? (
        <Select
          label="Customer" required placeholder="Select customer" value={customerId}
          options={customers.map((c) => ({ value: c.value, label: `${c.label} · ${c.raw.mobile}` }))}
          onChange={(e) => setCustomerId(e.target.value)}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Customer name" required value={customer.name} onChange={(e) => set('name', e.target.value)} />
          <Input label="Mobile number" required value={customer.mobile} onChange={(e) => set('mobile', e.target.value)} />
          <Input label="City" required value={customer.city} onChange={(e) => set('city', e.target.value)} />
          <Input label="Area" value={customer.area} onChange={(e) => set('area', e.target.value)} />
          <Input label="State" value={customer.state} onChange={(e) => set('state', e.target.value)} />
          <Input label="Pincode" value={customer.pincode} onChange={(e) => set('pincode', e.target.value)} />
          <Textarea wrapperClass="sm:col-span-2" label="Address" required value={customer.address} onChange={(e) => set('address', e.target.value)} />
        </div>
      )}
    </div>
  );
}
