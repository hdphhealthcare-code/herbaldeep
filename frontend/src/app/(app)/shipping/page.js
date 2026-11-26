import { redirect } from 'next/navigation';

// The old tabbed Shipping page is now a set of sidebar pages
export default function ShippingIndex() {
  redirect('/shipping/rate-calculator');
}
