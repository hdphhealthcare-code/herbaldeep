const mongoose = require('mongoose');

// One list of pickup locations for every courier. Xpressbees takes the address with each booking;
// Shipmozo needs a warehouse_id, which we create on its panel automatically the first time and remember here.
const warehouseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, unique: true, trim: true }, // sent as pickup.warehouse_name
    name: { type: String, required: true, trim: true },                // contact person
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true },
    address: { type: String, required: true, trim: true },
    address2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    providerIds: { type: mongoose.Schema.Types.Mixed, default: {} }, // e.g. { shipmozo: '23481' }, filled on first booking
    isDefault: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Warehouse', warehouseSchema);
