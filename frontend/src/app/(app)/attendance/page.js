'use client';

import { useState } from 'react';
import RoleGuard from '@/components/layout/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Tabs from '@/components/ui/Tabs';
import DailyAttendance from '@/components/attendance/DailyAttendance';
import MonthlyAttendance from '@/components/attendance/MonthlyAttendance';

const TABS = [{ value: 'daily', label: 'Mark attendance' }, { value: 'monthly', label: 'Monthly summary' }];

export default function AttendancePage() {
  const [tab, setTab] = useState('daily');
  return (
    <RoleGuard roles={['hr']}>
      <PageHeader title="Attendance" description="Mark daily attendance and review monthly summaries." />
      <Card padded={false}>
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
        {tab === 'daily' ? <DailyAttendance /> : <MonthlyAttendance />}
      </Card>
    </RoleGuard>
  );
}
