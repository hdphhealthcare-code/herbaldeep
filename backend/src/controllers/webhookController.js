const crypto = require('crypto');
const Order = require('../models/Order');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { webhookSecret } = require('../config/env');
const { deepFind } = require('../services/shipping/common');
const { applyTracking } = require('../services/trackingService');

const AWB_KEYS = ['awb_number', 'awb', 'awbNumber', 'waybill', 'waybill_number', 'wbn', 'tracking_id', 'tracking_number', 'lr_number'];
const STATUS_KEYS = ['current_status', 'shipment_status', 'status_text', 'status', 'current_status_description', 'scan_status'];

const same = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/**
 * Courier -> CRM push. Point the courier's webhook at:
 *   POST https://<your-api>/api/webhooks/<xpressbees|shipmozo|ekart|delhivery|shiprocket>?token=<WEBHOOK_SECRET>
 * The order is found by AWB and its status is updated the same way as the background sync.
 * We always answer 200 for a valid token so the courier does not keep retrying events we cannot match.
 */
exports.receive = asyncHandler(async (req, res) => {
  if (!webhookSecret) throw new ApiError(503, 'Webhooks are disabled. Set WEBHOOK_SECRET in backend/.env');
  const given = req.query.token || req.headers['x-webhook-secret'] || req.headers['x-api-key'] || '';
  if (!given || !same(given, webhookSecret)) throw new ApiError(401, 'Invalid webhook token');

  const body = req.body || {};
  // Delhivery nests everything under Shipment.Status and uses its own status words: its provider translates them
  const dl = req.params?.provider === 'delhivery' ? require('../services/shipping/delhivery').fromWebhook(body) : null;
  const awb = dl ? dl.awb : deepFind(body, AWB_KEYS, 3);
  const status = dl ? dl.status : deepFind(body, STATUS_KEYS, 3);
  if (!awb || !status) return res.json({ ok: true, matched: false });

  const order = await Order.findOne({ 'shipping.awb': String(awb), 'shipping.status': 'booked' });
  if (!order) return res.json({ ok: true, matched: false });

  const message = dl ? undefined : deepFind(body, ['remark', 'remarks', 'message', 'description', 'status_description']);
  const history = dl ? dl.history : [{
    message: [String(status), message && String(message) !== String(status) ? String(message) : ''].filter(Boolean).join(' - '),
    location: deepFind(body, ['location', 'city', 'current_location']),
    time: deepFind(body, ['event_time', 'timestamp', 'scan_time', 'datetime', 'updated_at']),
  }];
  const keep = (order.shipping.trackHistory || []).map((h) => (h.toObject ? h.toObject() : h));
  const { changed, to } = await applyTracking(order, { status: String(status), history: [...history, ...keep] }, { auto: true });
  await order.save();
  res.json({ ok: true, matched: true, changed, status: to });
});
