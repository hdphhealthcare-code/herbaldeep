import ActiveBadge from '@/components/common/ActiveBadge';
import { formatDate } from '@/lib/format';

export const employeesConfig = {
  title: 'Employees',
  description: 'Basic employee profiles used for attendance.',
  singular: 'Employee',
  endpoint: '/employees',
  searchPlaceholder: 'Search by name, ID, mobile or department',
  filters: [{ key: 'isActive', placeholder: 'All status', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] }],
  columns: [
    { key: 'employeeId', label: 'Employee ID' },
    { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'mobile', label: 'Mobile' },
    { key: 'designation', label: 'Designation' },
    { key: 'department', label: 'Department' },
    { key: 'joiningDate', label: 'Joined', render: (r) => formatDate(r.joiningDate) },
    { key: 'isActive', label: 'Status', render: (r) => <ActiveBadge active={r.isActive} /> },
  ],
  fields: [
    { name: 'employeeId', label: 'Employee ID', required: true },
    { name: 'name', label: 'Full name', required: true },
    { name: 'mobile', label: 'Mobile number', required: true },
    { name: 'email', label: 'Email', type: 'email' },
    { name: 'designation', label: 'Designation' },
    { name: 'department', label: 'Department' },
    { name: 'joiningDate', label: 'Joining date', type: 'date' },
    { name: 'address', label: 'Address', type: 'textarea', full: true },
    { name: 'isActive', label: 'Active', type: 'checkbox' },
  ],
  defaults: { isActive: true },
};
