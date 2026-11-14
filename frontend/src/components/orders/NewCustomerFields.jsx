'use client';

import { useState } from 'react';
import { INDIAN_STATES } from '@/lib/constants';
import PincodeInput from '@/components/common/PincodeInput';
import { Input, Textarea } from '@/components/ui/FormField';

// New-customer fields. Typing the pincode fills state, city and area suggestions.
export default function NewCustomerFields({ customer, setCustomer }) {
  const [areas, setAreas] = useState([]);
  const set = (k) => (e) => setCustomer({ ...customer, [k]: e.target.value });

  const fill = (info) => {
    setAreas(info.localities || []);
    setCustomer((c) => ({
      ...c,
      state: info.state || c.state,
      city: info.city || c.city,
      area: c.area || info.localities?.[0] || '',
    }));
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Input label="Customer name" required value={customer.name} onChange={set('name')} />
      <Input label="Mobile number" required inputMode="numeric" maxLength={10} value={customer.mobile}
        onChange={(e) => setCustomer({ ...customer, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} />
      <PincodeInput required value={customer.pincode} onChange={(v) => setCustomer((c) => ({ ...c, pincode: v }))} onFound={fill} />
      <Input label="City" required value={customer.city} onChange={set('city')} />
      <Input label="State" required list="state-options" value={customer.state} onChange={set('state')} />
      <Input label="Area / locality" list="area-options" value={customer.area} onChange={set('area')} />
      <Textarea wrapperClass="sm:col-span-2" label="Full address" required rows={2} value={customer.address} onChange={set('address')}
        hint="House / flat no, street, landmark" />
      <datalist id="state-options">{INDIAN_STATES.map((s) => <option key={s} value={s} />)}</datalist>
      <datalist id="area-options">{areas.map((a) => <option key={a} value={a} />)}</datalist>
    </div>
  );
}
