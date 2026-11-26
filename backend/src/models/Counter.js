const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });
const Counter = mongoose.model('Counter', counterSchema);

// Returns e.g. nextCode('order_hbd', 'HBD', 5) -> HBD-00001
Counter.nextCode = async (name, prefix, pad = 6) => {
  const c = await Counter.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return `${prefix}-${String(c.seq).padStart(pad, '0')}`;
};

module.exports = Counter;
