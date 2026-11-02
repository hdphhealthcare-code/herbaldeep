exports.ROLES = { SUPER_ADMIN: 'super_admin', ADMIN: 'admin', HR: 'hr', AGENT: 'agent' };

exports.ORDER_STATUS = [
  'new_order',
  'zone_identified',
  'agent_assigned',
  'ready_for_dispatch',
  'dispatched',
  'delivered',
  'invoice_generated',
  'cancelled',
];

// Statuses an agent is allowed to set on their own orders
exports.AGENT_ALLOWED_STATUS = ['dispatched', 'delivered'];

exports.INVOICE_STATUS = ['draft', 'generated', 'paid', 'pending'];
exports.ATTENDANCE_STATUS = ['present', 'absent', 'leave', 'half_day'];
