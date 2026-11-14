'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Download, FileSpreadsheet, Upload, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { downloadCsv, parseCsv } from '@/lib/csv';
import RoleGuard from '@/components/layout/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

const COLUMNS = ['order_ref', 'name', 'mobile', 'address', 'area', 'city', 'state', 'pincode', 'sku', 'quantity', 'discount', 'payment_type', 'cod_amount', 'weight_g', 'length_cm', 'width_cm', 'height_cm', 'notes', 'gst_number'];
const SAMPLE = [
  ['R1', 'Ravi Kumar', '9876543210', '12 MG Road', 'Connaught Place', 'New Delhi', 'Delhi', '110001', 'THERM-01', '2', '0', 'PREPAID', '', '500', '10', '10', '10', 'First order, two products'],
  ['R1', 'Ravi Kumar', '9876543210', '12 MG Road', 'Connaught Place', 'New Delhi', 'Delhi', '110001', 'BPM-01', '1', '100', 'PREPAID', '', '500', '10', '10', '10', ''],
  ['R2', 'Anita Sharma', '9123456780', '45 Park Street', '', 'Kolkata', 'West Bengal', '700016', 'THERM-01', '1', '0', 'COD', '', '500', '10', '10', '10', ''],
];
const MAX_ROWS = 500;

// Checks one row. Rows that share an order_ref are one order (several products).
const check = (r) => {
  const e = [];
  ['name', 'address', 'city', 'state', 'sku'].forEach((k) => { if (!String(r[k] || '').trim()) e.push(`${k} is missing`); });
  if (String(r.mobile || '').replace(/\D/g, '').length < 10) e.push('mobile must have 10 digits');
  if (!/^\d{6}$/.test(String(r.pincode || '').trim())) e.push('pincode must be 6 digits');
  const q = Number(r.quantity || 1);
  if (!Number.isInteger(q) || q < 1) e.push('quantity must be a whole number, at least 1');
  if (r.discount && !(Number(r.discount) >= 0)) e.push('discount must be a number');
  const pay = String(r.payment_type || 'PREPAID').toUpperCase();
  if (!['PREPAID', 'COD'].includes(pay)) e.push('payment_type must be PREPAID or COD');
  return e;
};

function BulkUpload() {
  const fileRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  // Per-row problems; if one row of a multi-product order is wrong, the whole order is held back
  const checked = useMemo(() => {
    const own = rows.map((r) => check(r));
    const badRefs = new Set(rows.flatMap((r, i) => (r.order_ref && own[i].length ? [r.order_ref] : [])));
    return rows.map((r, i) => ({
      row: r, line: i + 2,
      errors: own[i].length ? own[i] : (r.order_ref && badRefs.has(r.order_ref) ? ['another product of this order has a problem'] : []),
    }));
  }, [rows]);
  const good = checked.filter((c) => !c.errors.length);
  const bad = checked.filter((c) => c.errors.length);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setResult(null);
    if (!/\.csv$/i.test(file.name)) return toast.error('Upload a .csv file. In Excel use File > Save As > CSV');
    const parsed = parseCsv(await file.text());
    if (!parsed.length) return toast.error('The file has no rows');
    const missing = ['name', 'mobile', 'address', 'city', 'state', 'pincode', 'sku'].filter((k) => !(k in parsed[0]));
    if (missing.length) return toast.error(`Missing column(s): ${missing.join(', ')}. Download the template to see the format`);
    if (parsed.length > MAX_ROWS) return toast.error(`A file can have at most ${MAX_ROWS} rows`);
    setFileName(file.name);
    setRows(parsed);
  };

  const submit = async () => {
    setBusy(true);
    try {
      // line numbers shown in errors should match the file, so send the good rows with their original position kept in order_ref grouping
      const res = await api.post('/orders/bulk/import', { rows: good.map((c) => c.row) });
      setResult(res);
      if (res.created.length) toast.success(`${res.created.length} order(s) created`);
      if (res.failed.length) toast.error(`${res.failed.length} order(s) failed`);
      setRows([]); setFileName('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Bulk order upload" description="Create many orders from one CSV file. Every order is checked on its own, so one wrong row never blocks the others."
        actions={<Button variant="secondary" icon={Download} onClick={() => downloadCsv('orders-template.csv', COLUMNS, SAMPLE)}>Download template</Button>} />

      <div className="space-y-6">
        <Card title="1. Upload your file">
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border p-8 text-sm text-muted transition hover:border-primary hover:text-primary">
            <FileSpreadsheet className="h-8 w-8" />
            <span className="font-medium">{fileName || 'Click to choose a CSV file'}</span>
            <span className="text-xs">One row per product. Rows with the same <b>order_ref</b> become one order with several products.</span>
          </button>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-muted">
            <li><b>sku</b> must match an active product. <b>payment_type</b> is PREPAID or COD (empty = PREPAID). Pickup is the default warehouse.</li>
            <li>Weight in grams and size in cm are optional (default 500 g, 10 x 10 x 10 cm). <b>discount</b> is a flat amount in rupees.</li>
            <li>Maximum {MAX_ROWS} rows per file. New orders wait for confirmation, then an admin ships them.</li>
          </ul>
        </Card>

        {rows.length > 0 && (
          <Card title="2. Check and create"
            action={<Button icon={Upload} loading={busy} disabled={!good.length} onClick={submit}>Create {good.length} row(s)</Button>}>
            <p className="mb-3 text-sm"><b className="text-success">{good.length} ready</b>{bad.length > 0 && <>, <b className="text-danger">{bad.length} with problems (will be skipped)</b></>}</p>
            <div className="max-h-96 overflow-auto rounded-xl border border-border">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="sticky top-0 bg-surface-muted"><tr>{['Line', 'Customer', 'Mobile', 'Pincode', 'SKU', 'Qty', 'Payment', 'Check'].map((h) => <th key={h} className="eyebrow px-3 py-2 text-left">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-border">
                  {checked.map(({ row, line, errors }) => (
                    <tr key={line} className={errors.length ? 'bg-danger-soft/40' : ''}>
                      <td className="num px-3 py-2">{line}</td><td className="px-3 py-2">{row.name}</td><td className="num px-3 py-2">{row.mobile}</td>
                      <td className="num px-3 py-2">{row.pincode}</td><td className="num px-3 py-2">{row.sku}</td><td className="num px-3 py-2">{row.quantity || 1}</td>
                      <td className="px-3 py-2">{String(row.payment_type || 'PREPAID').toUpperCase()}</td>
                      <td className="px-3 py-2">{errors.length ? <span className="text-danger">{errors.join('; ')}</span> : <CheckCircle2 className="h-4 w-4 text-success" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {result && (
          <Card title="Result">
            <p className="mb-3 text-sm"><b className="text-success">{result.created.length} order(s) created</b>{result.failed.length > 0 && <>, <b className="text-danger">{result.failed.length} failed</b></>}</p>
            {result.failed.length > 0 && (
              <ul className="mb-4 space-y-1.5 text-sm">
                {result.failed.map((f) => <li key={f.label} className="flex items-start gap-2"><XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" /><span><b>{f.label}:</b> <span className="text-danger">{f.message}</span></span></li>)}
              </ul>
            )}
            {result.created.length > 0 && <p className="text-xs text-muted">Created: {result.created.map((c) => c.orderId).join(', ')}</p>}
            <Link href="/orders" className="mt-4 inline-block text-sm font-medium text-primary underline">Go to orders and confirm them</Link>
          </Card>
        )}
      </div>
    </>
  );
}

export default function Page() {
  return <RoleGuard roles={['admin', 'agent']}><BulkUpload /></RoleGuard>;
}
