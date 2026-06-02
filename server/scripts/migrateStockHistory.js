/**
 * migrateStockHistory.js
 *
 * Migrates the embedded stock_history arrays from all Product documents
 * into the standalone StockMovement collection.
 *
 * Usage:
 *   node scripts/migrateStockHistory.js            # live run
 *   node scripts/migrateStockHistory.js --dry-run  # preview only, no writes
 *
 * Run only once per environment. After migration, update all code that
 * writes to product.stock_history to write to StockMovement instead.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
require('dotenv').config();

const mongoose = require('mongoose');
const Product = require('../models/productModel');
const StockMovement = require('../models/stockMovementModel');

const DRY_RUN = process.argv.includes('--dry-run');

async function run() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  console.log(`Connected to MongoDB. Dry run: ${DRY_RUN}`);

  const cursor = Product.find({ 'stock_history.0': { $exists: true } }).cursor();

  let totalProducts = 0;
  let totalMovements = 0;
  let skipped = 0;

  for await (const product of cursor) {
    const entries = product.stock_history || [];
    if (!entries.length) continue;

    totalProducts += 1;
    totalMovements += entries.length;

    console.log(`  Product: ${product.name} (${product._id}) — ${entries.length} entries`);

    if (!DRY_RUN) {
      const docs = entries.map((e) => ({
        product:         product._id,
        shop:            product.shop,
        type:            e.type,
        quantity_change: e.quantity_change,
        quantity_after:  e.quantity_after,
        reference_id:    e.reference_id,
        note:            e.note,
        date:            e.date || new Date(),
      }));

      // insertMany with ordered:false so one bad doc doesn't halt the batch
      try {
        await StockMovement.insertMany(docs, { ordered: false });
      } catch (err) {
        if (err.code === 11000 || err.writeErrors) {
          // partial success — some may already exist, count inserted
          const inserted = err.result?.nInserted ?? 0;
          skipped += docs.length - inserted;
          console.warn(`    ${docs.length - inserted} entries skipped (likely duplicates)`);
        } else {
          throw err;
        }
      }

      // Clear the embedded array after successful migration
      await Product.findByIdAndUpdate(product._id, { $set: { stock_history: [] } });
    }
  }

  console.log('\n── Migration summary ─────────────────────────────');
  console.log(`  Products processed : ${totalProducts}`);
  console.log(`  Movements migrated : ${totalMovements}`);
  if (skipped > 0) console.log(`  Entries skipped    : ${skipped}`);
  if (DRY_RUN) console.log('\n  DRY RUN — no data was written.');
  console.log('──────────────────────────────────────────────────\n');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
