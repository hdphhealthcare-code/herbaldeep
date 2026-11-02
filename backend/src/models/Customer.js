const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, required: true },
    city: { type: String, required: true, trim: true },
    area: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: String,
    notes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Customer', customerSchema);
