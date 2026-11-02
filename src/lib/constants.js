export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  HR: 'hr',
  AGENT: 'agent',
};

export const ROLE_OPTIONS = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'hr', label: 'HR / Authorized User' },
  { value: 'agent', label: 'Agent' },
];

// Order workflow (matches SRS section 11)
export const ORDER_STATUS = [
  { value: 'new_order', label: 'New Order', tone: 'info' },
  { value: 'zone_identified', label: 'Zone Identified', tone: 'info' },
  { value: 'agent_assigned', label: 'Agent Assigned', tone: 'primary' },
  { value: 'ready_for_dispatch', label: 'Ready for Dispatch', tone: 'warning' },
  { value: 'dispatched', label: 'Dispatched', tone: 'warning' },
  { value: 'delivered', label: 'Delivered', tone: 'success' },
  { value: 'invoice_generated', label: 'Invoice Generated', tone: 'success' },
  { value: 'cancelled', label: 'Cancelled', tone: 'danger' },
];

export const INVOICE_STATUS = [
  { value: 'draft', label: 'Draft', tone: 'neutral' },
  { value: 'generated', label: 'Generated', tone: 'info' },
  { value: 'pending', label: 'Pending', tone: 'warning' },
  { value: 'paid', label: 'Paid', tone: 'success' },
];

export const ATTENDANCE_STATUS = [
  { value: 'present', label: 'Present', tone: 'success' },
  { value: 'absent', label: 'Absent', tone: 'danger' },
  { value: 'leave', label: 'Leave', tone: 'warning' },
  { value: 'half_day', label: 'Half Day', tone: 'info' },
];

export const DISPATCH_STATUS = ['pending', 'ready', 'dispatched'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }));
export const DELIVERY_STATUS = ['pending', 'in_transit', 'delivered', 'returned'].map((v) => ({
  value: v,
  label: v.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase()),
}));

// What an agent is allowed to set (mirrors backend)
export const AGENT_STATUS_OPTIONS = ORDER_STATUS.filter((s) => ['dispatched', 'delivered'].includes(s.value));
