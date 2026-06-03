const StockMovement = require('../models/stockMovementModel');

/**
 * Fire-and-forget — never throws, never blocks the calling transaction.
 * items: [{ product, quantityChange, quantityAfter, type, referenceId, referenceType, note, performedBy }]
 */
const logStockMovements = (shopId, items = []) => {
  if (!items.length) return;
  const docs = items.map(i => ({
    product:         i.product,
    shop:            shopId,
    type:            i.type,
    quantity_change: i.quantityChange,
    quantity_after:  i.quantityAfter,
    reference_id:    i.referenceId   || '',
    reference_type:  i.referenceType || '',
    note:            i.note          || '',
    performed_by:    i.performedBy   || null,
    date:            new Date(),
  }));
  StockMovement.insertMany(docs, { ordered: false }).catch(() => {});
};

module.exports = { logStockMovements };
