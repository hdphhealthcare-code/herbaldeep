'use client';

import { useState } from 'react';
import { monthISO } from '@/lib/format';
import useFetch from '@/hooks/useFetch';
import useOptions from '@/hooks/useOptions';
import { Select } from '@/components/ui/FormField';
import DataTable from '@/components/ui/DataTable';

export default function MonthlyAttendance() {
  const [month, setMonth] = useState(monthISO());
  const [employee, setEmployee] = useState('');
  const employees = useOptions('/employees');
  const { data, loading } = useFetch('/attendance/monthly', { month, employee });

  const columns = [
    { key: 'name', label: 'Employee', render: (r) => <div><p className="font-medium">{r.employee.name}</p><p className="text-xs text-muted">{r.employee.employeeId}</p></div> },
    { key: 'present', label: 'Present', render: (r) => <span className="text-success">{r.present}</span> },
    { key: 'absent', label: 'Absent', render: (r) => <span className="text-danger">{r.absent}</span> },
    { key: 'leave', label: 'Leave', render: (r) => <span className="text-warning">{r.leave}</span> },
    { key: 'half_day', label: 'Half day', render: (r) => <span className="text-info">{r.half_day}</span> },
    { key: 'total', label: 'Days marked', render: (r) => Object.keys(r.days).length },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
        <input type="month" className="input-base w-44" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month" />
        <Select wrapperClass="w-56" placeholder="All employees" options={employees} value={employee} onChange={(e) => setEmployee(e.target.value)} />
      </div>
      <DataTable columns={columns} rows={data || []} loading={loading} rowKey="_id"
        emptyTitle="No attendance for this month" emptyDescription="Mark daily attendance and the summary will appear here." />
    </div>
  );
}
