import ActiveBadge from '@/components/common/ActiveBadge';
import Badge from '@/components/ui/Badge';

export const zonesConfig = {
  title: 'Zones',
  description: 'Orders are matched to a zone using the customer city or area.',
  singular: 'Zone',
  endpoint: '/zones',
  searchPlaceholder: 'Search zones',
  columns: [
    { key: 'name', label: 'Zone', render: (r) => <span className="font-medium">{r.name}</span> },
    {
      key: 'areas', label: 'Service areas',
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.areas?.length ? r.areas.map((a) => <Badge key={a} tone="primary">{a}</Badge>) : '-'}
        </div>
      ),
    },
    { key: 'isActive', label: 'Status', render: (r) => <ActiveBadge active={r.isActive} /> },
  ],
  fields: [
    { name: 'name', label: 'Zone name', required: true, full: true },
    { name: 'areas', label: 'Service areas (cities / areas)', full: true, hint: 'Comma separated, e.g. delhi, noida, gurugram' },
    { name: 'description', label: 'Description', type: 'textarea', full: true },
    { name: 'isActive', label: 'Active', type: 'checkbox' },
  ],
  defaults: { isActive: true },
};
