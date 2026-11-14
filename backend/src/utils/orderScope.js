const { ROLES } = require('../config/constants');

/**
 * Which orders a user may see. This is the single rule used by every order endpoint.
 *  - agent: only the orders that belong to them (Agent A never sees Agent B's orders)
 *  - everybody else who may open orders (admin, super admin, ndr): all orders
 */
exports.scopeFor = (user) => (user.role === ROLES.AGENT ? { agent: user._id } : {});

// Roles that may open the orders area at all
exports.ORDER_READERS = ['admin', 'agent', 'ndr'];
