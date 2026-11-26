const { FINAL_STATUS } = require('../../config/constants');

/**
 * Courier wording -> CRM order status.
 * Every courier words its scans differently ("Out For Delivery", "OFD", "Undelivered", "RTO_INITIATED"...), so the text is
 * matched in a fixed order: the most specific meanings first ("undelivered" must be checked before "delivered").
 * Returns null when the text means nothing to us (the order then keeps its current status).
 */
const RULES = [
  ['rto_delivered', /(rto|return(ed)?\s*to\s*(origin|seller|shipper)).*(deliver|received|complete)|rto[\s_-]*delivered|returned\s*to\s*(origin|seller|shipper)/],
  ['rto', /\brto\b|rto[_\s-]|return(ed)?\s*to\s*(origin|seller|shipper)|returning|return\s*(initiated|in\s*transit)/],
  ['cancelled', /cancel/],
  ['out_for_delivery', /out\s*for\s*delivery|\bofd\b/],
  ['ndr', /undeliver|\bndr\b|not\s*delivered|delivery\s*(attempt|failed|exception)|attempt(ed)?\b|failed\s*delivery|consignee\s*(unavailable|refused|not)|customer\s*(unavailable|refused|not\s*available)|address\s*(issue|incorrect|not\s*found)|\bexception\b/],
  ['delivered', /\bdelivered\b|delivery\s*(done|complete)/],
  ['ready_for_dispatch', /out\s*for\s*pickup|not\s*picked|pick\s*-?\s*up\s*(pending|scheduled|requested|generated|failed|rescheduled|awaited)|pending\s*pick|awaiting|manifest|booked|created|placed|^pending|shipment\s*pending/],
  ['in_transit', /transit|picked|pick\s*-?\s*up\s*(done|complete)|shipped|dispatch|reached|arrived|departed|\bhub\b|bagged|forwarded|received\s*at|in\s*scan|out\s*scan|connected/],
];

const mapCourierStatus = (text) => {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return null;
  const hit = RULES.find(([, rx]) => rx.test(t));
  return hit ? hit[0] : null;
};

// Decides the new CRM status from the current one and what the courier says.
// - finished orders (delivered / returned / invoiced / cancelled) never move again
// - "ready for dispatch" is only used before pickup; a late "pickup pending" scan must not pull an order back
// - once the parcel is returning (rto), ordinary transit scans do not turn it back into a forward shipment
const nextStatus = (current, mapped) => {
  if (!mapped || FINAL_STATUS.includes(current)) return current;
  if (mapped === 'cancelled') return current === 'ready_for_dispatch' ? 'cancelled_by_courier' : current;
  if (mapped === 'ready_for_dispatch') return ['new_order', 'agent_assigned', 'confirmed'].includes(current) ? 'ready_for_dispatch' : current;
  if (current === 'rto' && ['in_transit', 'out_for_delivery', 'ndr'].includes(mapped)) return current;
  return mapped;
};

module.exports = { mapCourierStatus, nextStatus };
