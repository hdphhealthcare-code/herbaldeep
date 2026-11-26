'use client';

import { CheckCircle2, Loader2 } from 'lucide-react';
import usePincode from '@/hooks/usePincode';
import { Input } from '@/components/ui/FormField';

/**
 * Pincode box that fills state / city / area by itself.
 * onFound(info) receives { state, city, district, localities, approximate } to put into the surrounding form.
 */
export default function PincodeInput({ value, onChange, onFound, label = 'Pincode', required, wrapperClass, hint }) {
  const { info, loading, error } = usePincode(value, onFound);

  const status = loading ? (
    <span className="inline-flex items-center gap-1 text-muted"><Loader2 className="h-3 w-3 animate-spin" /> Checking pincode...</span>
  ) : error ? (
    <span className="text-danger">{error}</span>
  ) : info ? (
    <span className={`inline-flex items-center gap-1 ${info.approximate ? 'text-warning' : 'text-success'}`}>
      <CheckCircle2 className="h-3 w-3" />
      {[info.city, info.state].filter(Boolean).join(', ')}{info.approximate ? ' (state only, check city)' : ''}
    </span>
  ) : hint || 'City and state fill automatically';

  return (
    <Input
      label={label} required={required} wrapperClass={wrapperClass} inputMode="numeric" maxLength={6} autoComplete="postal-code"
      placeholder="6-digit pincode" value={value || ''}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      hint={status}
    />
  );
}
