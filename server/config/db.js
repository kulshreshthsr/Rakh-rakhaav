const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');
    await dropLegacyIndexes();
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

async function dropLegacyIndexes() {
  try {
    const db = mongoose.connection.db;
    await Promise.all([
      db.collection('sales').dropIndex('shop_1_offline_operation_id_1').catch(() => {}),
      db.collection('purchases').dropIndex('shop_1_offline_operation_id_1').catch(() => {}),
    ]);
  } catch {}
}

module.exports = connectDB;