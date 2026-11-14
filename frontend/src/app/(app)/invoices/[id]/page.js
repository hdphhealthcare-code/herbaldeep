'use client';

import { useParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { INVOICE_STATUS } from '@/lib/constants';
import useFetch from '@/hooks/useFetch';
import RoleGuard from '@/components/layout/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import { Select } from '@/components/ui/FormField';
import InvoicePrint from '@/components/invoice/InvoicePrint';

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const { data: invoice, loading, error, reload } = useFetch(`/invoices/${id}`);

  const changeStatus = async (status) => {
    try {
      await api.put(`/invoices/${id}/status`, { status });
      toast.success('Invoice status updated');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <Spinner />;
  if (error || !invoice) return <p className="text-sm text-danger">{error || 'Invoice not found'}</p>;

  return (
    <RoleGuard roles={['admin']}>
      <div className="no-print">
        <PageHeader
          title={invoice.invoiceNo}
          actions={(
            <>
              <Select wrapperClass="w-40" options={INVOICE_STATUS} value={invoice.status} onChange={(e) => changeStatus(e.target.value)} aria-label="Invoice status" />
              <Button icon={Printer} onClick={() => window.print()}>Print / Save PDF</Button>
            </>
          )}
        />
      </div>
      <InvoicePrint invoice={invoice} />
    </RoleGuard>
  );
}
