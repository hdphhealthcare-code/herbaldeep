const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true },
    email: { type: String, lowercase: true, trim: true },
    designation: String,
    department: String,
    joiningDate: Date,
    address: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Employee', employeeSchema);
