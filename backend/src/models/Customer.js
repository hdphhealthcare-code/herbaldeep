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
    pincode: {
      type: String,
      trim: true,
      validate: { validator: (v) => !v || /^\d{6}$/.test(v), message: 'Pincode must be 6 digits' },
    },
    notes: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // an agent sees only the customers they added
  },
  { timestamps: true }
);

customerSchema.index({ name: 1 });
customerSchema.index({ pincode: 1 });

module.exports = mongoose.model('Customer', customerSchema);
