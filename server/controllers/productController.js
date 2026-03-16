const pool = require('../config/db');

const getProducts = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM products WHERE shop_id IN (SELECT id FROM shops WHERE owner_id = $1) ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createProduct = async (req, res) => {
  const { name, description, price, quantity, unit } = req.body;
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
      'INSERT INTO products (shop_id, name, description, price, quantity, unit) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [shopId, name, description, price, quantity, unit]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name, description, price, quantity, unit } = req.body;
  try {
    const result = await pool.query(
      'UPDATE products SET name=$1, description=$2, price=$3, quantity=$4, unit=$5 WHERE id=$6 RETURNING *',
      [name, description, price, quantity, unit, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteProduct = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getProducts, createProduct, updateProduct, deleteProduct };