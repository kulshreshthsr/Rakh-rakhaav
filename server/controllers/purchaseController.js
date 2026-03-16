const pool = require('../config/db');

const getPurchases = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, pr.name as product_name FROM purchases p 
       JOIN products pr ON p.product_id = pr.id 
       JOIN shops sh ON p.shop_id = sh.id 
       WHERE sh.owner_id = $1 
       ORDER BY p.purchased_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createPurchase = async (req, res) => {
  const { product_id, quantity, price_per_unit } = req.body;
  const total_amount = quantity * price_per_unit;
  try {
    let shopResult = await pool.query('SELECT id FROM shops WHERE owner_id = $1', [req.user.id]);
    let shopId;
    if (shopResult.rows.length === 0) {
      const newShop = await pool.query(
        'INSERT INTO shops (name, owner_id) VALUES ($1, $2) RETURNING id',
        ['My Shop', req.user.id]
      );
      shopId = newShop.rows[0].id;
    } else {
      shopId = shopResult.rows[0].id;
    }
    const result = await pool.query(
      'INSERT INTO purchases (shop_id, product_id, quantity, price_per_unit, total_amount) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [shopId, product_id, quantity, price_per_unit, total_amount]
    );
    await pool.query('UPDATE products SET quantity = quantity + $1 WHERE id = $2', [quantity, product_id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getPurchases, createPurchase };