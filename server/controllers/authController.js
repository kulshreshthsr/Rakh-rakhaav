const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const Shop = require('../models/shopModel');

const getOrCreateShop = async (userId) => {
  let shop = await Shop.findOne({ owner: userId });
  if (!shop) shop = await Shop.create({ name: 'My Shop', owner: userId });
  return shop;
};

const register = async (req, res) => {
  const { name, username, password } = req.body;
  try {
    const userExists = await User.findOne({ username: username.toLowerCase() });
    if (userExists) return res.status(400).json({ message: 'Username already taken. Please choose another.' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, username: username.toLowerCase(), password: hashedPassword });
    await Shop.create({ name: 'My Shop', owner: user._id });

    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ user: { id: user._id, name: user.name, username: user.username }, token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) return res.status(400).json({ message: 'Invalid username or password' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid username or password' });

    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: { id: user._id, name: user.name, username: user.username }, token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateProfile = async (req, res) => {
  const { name } = req.body;
  try {
    const user = await User.findByIdAndUpdate(req.user.id, { name }, { new: true });
    res.json({ id: user._id, name: user.name, username: user.username });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updatePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const user = await User.findById(req.user.id);
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: 'Password updated!' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getShop = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    res.json(shop);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateShop = async (req, res) => {
  const { name, address, city, state, pincode, gstin, phone, email } = req.body;
  try {
    const shop = await getOrCreateShop(req.user.id);
    const updated = await Shop.findByIdAndUpdate(
      shop._id,
      { name, address, city, state, pincode, gstin, phone, email },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { register, login, updateProfile, updatePassword, getShop, updateShop };