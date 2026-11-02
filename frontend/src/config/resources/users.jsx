import ActiveBadge from '@/components/common/ActiveBadge';
import Badge from '@/components/ui/Badge';
import { ROLE_OPTIONS } from '@/lib/constants';
import { humanize } from '@/lib/format';

const userFields = (roleLocked) => [
  { name: 'name', label: 'Full name', required: true },
  { name: 'email', label: 'Login email', type: 'email', required: true },
  { name: 'mobile', label: 'Mobile number' },
  { name: 'password', label: 'Password', type: 'password', required: true, requiredOnCreateOnly: true, hint: 'Leave blank to keep the current password' },
  ...(roleLocked ? [] : [{ name: 'role', label: 'Role', type: 'select', options: ROLE_OPTIONS, required: true }]),
  { name: 'zone', label: 'Assigned zone (agents)', type: 'select', optionsFrom: { endpoint: '/zones', params: { isActive: true } } },
  { name: 'isActive', label: 'Active', type: 'checkbox' },
];

const baseColumns = [
  { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
  { key: 'email', label: 'Email' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'zone', label: 'Zone', render: (r) => r.zone?.name || '-' },
  { key: 'isActive', label: 'Status', render: (r) => <ActiveBadge active={r.isActive} /> },
];

export const agentsConfig = {
  title: 'Agents',
  description: 'Field agents who receive and deliver orders.',
  singular: 'Agent',
  endpoint: '/users',
  fixedParams: { role: 'agent' },
  searchPlaceholder: 'Search agents',
  columns: baseColumns,
  fields: userFields(true),
  defaults: { role: 'agent', isActive: true },
  canDelete: false,
};

export const usersConfig = {
  title: 'Users & Roles',
  description: 'Super admin only. Manage who can log in and what they can do.',
  singular: 'User',
  endpoint: '/users',
  searchPlaceholder: 'Search users',
  filters: [{ key: 'role', placeholder: 'All roles', options: ROLE_OPTIONS }],
  columns: [
    ...baseColumns.slice(0, 2),
    { key: 'role', label: 'Role', render: (r) => <Badge tone="primary">{humanize(r.role)}</Badge> },
    ...baseColumns.slice(3),
  ],
  fields: userFields(false),
  defaults: { role: 'admin', isActive: true },
};
