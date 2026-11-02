import Badge from '@/components/ui/Badge';
import { ORDER_STATUS, INVOICE_STATUS, ATTENDANCE_STATUS } from '@/lib/constants';

const MAPS = { order: ORDER_STATUS, invoice: INVOICE_STATUS, attendance: ATTENDANCE_STATUS };

export default function StatusBadge({ type = 'order', value }) {
  const found = MAPS[type].find((s) => s.value === value);
  return <Badge tone={found?.tone || 'neutral'}>{found?.label || value || '-'}</Badge>;
}
