// Roles:
//  super_admin  everything, manages users
//  admin        full order control: the ONLY role that can ship (book a courier); also products, stock, invoices, customers
//  agent        creates + confirms ORDERS and checks pincode serviceability. Sees only their own orders. Cannot ship.
//  ndr          NDR department: sees every order, takes NDR actions (re-attempt) and checks serviceability. Cannot create or ship.
//  hr           employees + attendance
exports.ROLES = { SUPER_ADMIN: 'super_admin', ADMIN: 'admin', HR: 'hr', AGENT: 'agent', NDR: 'ndr' };

// Order lifecycle. Everything after "ready_for_dispatch" is set automatically from the courier's live tracking:
// nobody changes these by hand.
exports.ORDER_STATUS = [
  'new_order',
  'agent_assigned',
  'confirmed',
  'ready_for_dispatch',
  'in_transit',
  'out_for_delivery',
  'ndr',
  'delivered',
  'rto',
  'rto_delivered',
  'invoice_generated',
  'cancelled',
];

// Once an order reaches one of these, courier updates no longer change it.
exports.FINAL_STATUS = ['delivered', 'rto_delivered', 'invoice_generated', 'cancelled'];

// An order can be cancelled only before the courier has picked the parcel up.
exports.CANCELLABLE_STATUS = ['new_order', 'agent_assigned', 'confirmed', 'ready_for_dispatch'];

// Created but not yet confirmed. An order must be confirmed (by the agent or an admin) before an admin can ship it.
exports.PRE_CONFIRM_STATUS = ['new_order', 'agent_assigned'];
// Orders that can still be edited (nothing booked with a courier yet)
exports.EDITABLE_STATUS = ['new_order', 'agent_assigned', 'confirmed'];

// The agent can be assigned once and changed this many times. After that the assignment is locked.
exports.MAX_AGENT_CHANGES = 1;

exports.INVOICE_STATUS = ['draft', 'generated', 'paid', 'pending'];
exports.ATTENDANCE_STATUS = ['present', 'absent', 'leave', 'half_day'];

// GST is fixed for every order. Prices INCLUDE GST: the order shows how much of the total is GST, it never adds it on top.
exports.GST_RATE = 5;
exports.BRAND_NAME = process.env.BRAND_NAME || 'Herbal Deep';

// Order numbers: HBD-00001, HBD-00002 ...
exports.ORDER_PREFIX = 'HBD';
exports.ORDER_PAD = 5;
