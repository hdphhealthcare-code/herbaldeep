import Link from 'next/link';
import Card from '@/components/ui/Card';
import StatusBadge from '@/components/common/StatusBadge';
import { ORDER_STATUS } from '@/lib/constants';

export default function StatusBreakdown({ byStatus = {} }) {
  return (
    <Card title="Orders by status" action={<Link href="/orders" className="text-xs font-medium text-primary">View all</Link>}>
      <ul className="divide-y divide-border">
        {ORDER_STATUS.map((s) => (
          <li key={s.value} className="flex items-center justify-between py-2.5">
            <StatusBadge value={s.value} />
            <span className="text-sm font-semibold">{byStatus[s.value] || 0}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
