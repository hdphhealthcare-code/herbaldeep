'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

// Shows what a bulk action did to each order: one bad order never hides the others.
export default function BulkResultModal({ title, report, onClose }) {
  return (
    <Modal open={Boolean(report)} onClose={onClose} title={title} footer={<Button onClick={onClose}>Close</Button>}>
      {report && (
        <>
          <p className="mb-3 text-sm"><b className="text-success">{report.ok} done</b>{report.failed > 0 && <>, <b className="text-danger">{report.failed} not done</b></>}</p>
          <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
            {report.results.map((r) => (
              <li key={r.id} className="flex items-start gap-2">
                {r.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />}
                <span><b className="num">{r.orderId}</b>{!r.ok && <span className="text-danger"> {r.message}</span>}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
