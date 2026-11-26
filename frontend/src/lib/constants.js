export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  HR: 'hr',
  AGENT: 'agent',
  NDR: 'ndr',
};

export const ROLE_OPTIONS = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'hr', label: 'HR / Authorized User' },
  { value: 'agent', label: 'Agent (create & confirm orders)' },
  { value: 'ndr', label: 'NDR Department' },
];

// Order lifecycle. After "Ready for dispatch" the status follows the courier automatically (nobody edits it by hand).
export const ORDER_STATUS = [
  { value: 'new_order', label: 'Pending Confirmation', tone: 'info' },
  { value: 'agent_assigned', label: 'Pending Confirmation', tone: 'primary' },
  { value: 'confirmed', label: 'Confirmed', tone: 'success' },
  { value: 'ready_for_dispatch', label: 'Ready for Dispatch', tone: 'warning' },
  { value: 'in_transit', label: 'In Transit', tone: 'warning' },
  { value: 'out_for_delivery', label: 'Out for Delivery', tone: 'primary' },
  { value: 'ndr', label: 'Delivery Failed (NDR)', tone: 'danger' },
  { value: 'delivered', label: 'Delivered', tone: 'success' },
  { value: 'rto', label: 'RTO (Returning)', tone: 'danger' },
  { value: 'rto_delivered', label: 'RTO Delivered', tone: 'neutral' },
  { value: 'invoice_generated', label: 'Invoice Generated', tone: 'success' },
  { value: 'cancelled', label: 'Cancelled', tone: 'danger' },
];

// Steps shown in the live progress tracker of an order
export const TRACK_STEPS = [
  { value: 'new_order', label: 'Order created' },
  { value: 'confirmed', label: 'Order confirmed' },
  { value: 'ready_for_dispatch', label: 'Ready for dispatch' },
  { value: 'in_transit', label: 'In transit' },
  { value: 'out_for_delivery', label: 'Out for delivery' },
  { value: 'delivered', label: 'Delivered' },
];

// Order list tabs (same buckets as the Xpressbees panel). `value` is sent to the API as ?tab=
export const ORDER_TABS = [
  { value: 'pending', label: 'Pending Confirmation' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'ready_to_ship', label: 'Ready to Ship' },
  { value: 'ready_to_pickup', label: 'Ready to Pickup' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'ndr', label: 'NDR' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'rto', label: 'RTO' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: '', label: 'All' },
];

export const GST_RATE = 5; // fixed GST on every order (percent). Product prices INCLUDE it: GST is shown, never added on top

// Finished orders: the courier no longer changes them, so live refresh stops
export const FINAL_STATUS = ['delivered', 'rto_delivered', 'invoice_generated', 'cancelled'];
export const CANCELLABLE_STATUS = ['new_order', 'agent_assigned', 'confirmed', 'ready_for_dispatch'];
// created but not confirmed yet / still editable (nothing booked with a courier)
export const PRE_CONFIRM_STATUS = ['new_order', 'agent_assigned'];
export const EDITABLE_STATUS = ['new_order', 'agent_assigned', 'confirmed'];

// Who can do what (the API enforces the same rules)
export const isAdminRole = (role) => role === 'admin' || role === 'super_admin';
export const canCreateOrders = (role) => isAdminRole(role) || role === 'agent';
export const canConfirmOrders = canCreateOrders;
export const MAX_AGENT_CHANGES = 1;

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

export const INDIAN_STATES = [
  'Andaman & Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra & Nagar Haveli and Daman & Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu & Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];
