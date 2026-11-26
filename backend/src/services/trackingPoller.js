const Order = require('../models/Order');
const registry = require('./shipping');
const shippingSvc = require('./orderShippingService');
const { FINAL_STATUS } = require('../config/constants');
const { tracking } = require('../config/env');

/**
 * Live status: a background job asks the courier about every booked, unfinished shipment and updates the order.
 * Nobody changes the status by hand. Webhooks (routes/webhookRoutes.js) make it instant when a courier pushes events.
 */
const BATCH = 150;
const CONCURRENCY = 4;
let timer = null;
let running = false;

async function runOnce({ force = false } = {}) {
  if (running) return { skipped: true, checked: 0, updated: 0, failed: 0 };
  running = true;
  const stats = { checked: 0, updated: 0, failed: 0 };
  try {
    const live = new Set(registry.configured().map((p) => p.id));
    if (!live.size) return stats;

    const staleBefore = new Date(Date.now() - (force ? 0 : tracking.minAgeMs));
    const orders = await Order.find({
      'shipping.status': 'booked',
      status: { $nin: FINAL_STATUS },
      'shipping.lastTrackedAt': { $not: { $gte: staleBefore } },
    }).sort({ 'shipping.lastTrackedAt': 1 }).limit(BATCH);

    const due = orders.filter((o) => live.has(o.shipping.provider || 'xpressbees'));
    for (let i = 0; i < due.length; i += CONCURRENCY) {
      const results = await Promise.allSettled(due.slice(i, i + CONCURRENCY).map(async (order) => {
        const before = order.status;
        await shippingSvc.track(order, null, { auto: true });
        return order.status !== before;
      }));
      results.forEach((r) => {
        stats.checked += 1;
        if (r.status === 'rejected') stats.failed += 1;
        else if (r.value) stats.updated += 1;
      });
    }
  } catch (err) {
    console.error('[tracking] sync run failed:', err.message);
  } finally {
    running = false;
  }
  return stats;
}

function start() {
  if (!tracking.enabled || timer) return;
  timer = setInterval(() => runOnce().then((s) => {
    if (s.checked) console.log(`[tracking] checked ${s.checked}, updated ${s.updated}, failed ${s.failed}`);
  }), tracking.intervalMs);
  timer.unref?.();
  console.log(`[tracking] live status sync every ${Math.round(tracking.intervalMs / 1000)}s`);
}

const stop = () => { if (timer) clearInterval(timer); timer = null; };

module.exports = { start, stop, runOnce };
