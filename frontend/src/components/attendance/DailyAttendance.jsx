'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { ATTENDANCE_STATUS } from '@/lib/constants';
import { todayISO } from '@/lib/format';
import useFetch from '@/hooks/useFetch';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';

const TONE_ACTIVE = {
  success: 'bg-success text-primary-foreground border-success',
  danger: 'bg-danger text-primary-foreground border-danger',
  warning: 'bg-warning text-primary-foreground border-warning',
  info: 'bg-info text-primary-foreground border-info',
};

export default function DailyAttendance() {
  const [date, setDate] = useState(todayISO());
  const { data, loading } = useFetch('/attendance', { date });
  const [marks, setMarks] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setMarks(Object.fromEntries(data.map((r) => [r.employee._id, r.status])));
  }, [data]);

  const markAll = (status) => setMarks(Object.fromEntries((data || []).map((r) => [r.employee._id, status])));

  const save = async () => {
    const records = Object.entries(marks).filter(([, s]) => s).map(([employee, status]) => ({ employee, status }));
    if (!records.length) return toast.error('Mark at least one employee');
    setSaving(true);
    try {
      await api.post('/attendance/mark', { date, records });
      toast.success('Attendance saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
        <input type="date" className="input-base w-44" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} aria-label="Attendance date" />
        <Button variant="soft" size="sm" onClick={() => markAll('present')}>Mark all present</Button>
        <div className="ml-auto"><Button loading={saving} onClick={save}>Save attendance</Button></div>
      </div>
      {loading && <Spinner />}
      {!loading && data && !data.length && <EmptyState title="No active employees" description="Add employees first to mark attendance." />}
      {!loading && data?.map((row) => (
        <div key={row.employee._id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-0">
          <div>
            <p className="text-sm font-medium">{row.employee.name}</p>
            <p className="text-xs text-muted">{row.employee.employeeId} · {row.employee.department || 'No department'}</p>
          </div>
          <div className="flex gap-1.5">
            {ATTENDANCE_STATUS.map((s) => {
              const active = marks[row.employee._id] === s.value;
              return (
                <button
                  key={s.value} type="button"
                  onClick={() => setMarks({ ...marks, [row.employee._id]: s.value })}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${active ? TONE_ACTIVE[s.tone] : 'border-border text-muted hover:bg-surface-muted'}`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
