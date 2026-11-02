'use client';

import Link from 'next/link';
import { FilePlus2, FileText } from 'lucide-react';
import Button from '@/components/ui/Button';

// Shows "Create invoice" once an order is delivered (workflow step 7)
export default function OrderHeaderActions({ order, invoice }) {
  if (invoice) {
    return <Link href={`/invoices/${invoice._id}`}><Button variant="secondary" icon={FileText}>View {invoice.invoiceNo}</Button></Link>;
  }
  if (['delivered', 'dispatched'].includes(order.status)) {
    return <Link href={`/invoices/new?order=${order._id}`}><Button icon={FilePlus2}>Create invoice</Button></Link>;
  }
  return null;
}
