const mongoose = require('mongoose');
const { mongoUri } = require('./env');

module.exports = async function connectDB() {
  mongoose.set('strictQuery', true);
  if (!mongoUri) throw new Error('MONGO_URI is missing. Copy backend/.env.example to backend/.env');
  await mongoose.connect(mongoUri);
  console.log(`MongoDB connected: database "${mongoose.connection.name}" on ${mongoose.connection.host}`);
};
