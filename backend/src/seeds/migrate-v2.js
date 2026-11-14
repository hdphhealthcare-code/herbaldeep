/**
 * One-time upgrade for databases created before the "live courier status" version:
 *   - removes zones (collection, orders.zone, users.zone)
 *   - zone_identified  -> new_order / agent_assigned
 *   - dispatched       -> in_transit
 * Safe to run more than once.   npm run migrate:v2
 */
require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const orders = db.collection('orders');

  const zoneIdentified = await orders.updateMany({ status: 'zone_identified', agent: { $exists: true, $ne: null } }, { $set: { status: 'agent_assigned' } });
  const zoneOnly = await orders.updateMany({ status: 'zone_identified' }, { $set: { status: 'new_order' } });
  const dispatched = await orders.updateMany({ status: 'dispatched' }, { $set: { status: 'in_transit' } });
  // History entries keep working in the timeline, so rename them too
  await orders.updateMany({ 'statusHistory.status': 'zone_identified' }, { $set: { 'statusHistory.$[h].status': 'new_order' } }, { arrayFilters: [{ 'h.status': 'zone_identified' }] });
  await orders.updateMany({ 'statusHistory.status': 'dispatched' }, { $set: { 'statusHistory.$[h].status': 'in_transit' } }, { arrayFilters: [{ 'h.status': 'dispatched' }] });
  await orders.updateMany({}, { $unset: { zone: '' } });
  await db.collection('users').updateMany({}, { $unset: { zone: '' } });
  await db.collection('zones').drop().catch(() => null);

  console.log(`Migrated: ${zoneIdentified.modifiedCount + zoneOnly.modifiedCount} zone_identified, ${dispatched.modifiedCount} dispatched. Zones removed.`);
  await mongoose.disconnect();
})().catch((err) => { console.error(err.message); process.exit(1); });
