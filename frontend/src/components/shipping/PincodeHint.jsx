'use client';

import usePincode from '@/hooks/usePincode';

// Small "city, state" confirmation under a pincode box
export default function PincodeHint({ pincode }) {
  const { info, loading, error } = usePincode(pincode);
  if (loading) return 'Checking pincode...';
  if (error) return <span className="text-danger">{error}</span>;
  if (info) return <span className="text-success">{[info.city, info.state].filter(Boolean).join(', ')}</span>;
  return undefined;
}
