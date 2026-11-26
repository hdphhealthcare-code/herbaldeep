import Badge from '@/components/ui/Badge';

export default function ActiveBadge({ active }) {
  return <Badge tone={active ? 'success' : 'neutral'}>{active ? 'Active' : 'Inactive'}</Badge>;
}
