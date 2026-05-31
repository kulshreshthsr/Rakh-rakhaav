`const { body, param, query, validationResult } = require('express-validator');

// Validation result handler
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// Auth validations
const registerValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters')
    .escape(),
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores')
    .escape(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase, and number'),
  validate
];

const loginValidation = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .escape(),
  body('password')
    .notEmpty().withMessage('Password is required'),
  validate
];

const forgotPasswordValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  validate
];

const resetPasswordValidation = [
  param('token')
    .notEmpty().withMessage('Reset token is required')
    .isLength({ min: 64, max: 64 }).withMessage('Invalid reset token'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase, and number'),
  validate
];

// Product validations
const createProductValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Product name is required')
    .isLength({ min: 2, max: 200 }).withMessage('Product name must be 2-200 characters')
    .escape(),
  body('sku')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('SKU must be max 50 characters')
    .escape(),
  body('hsnCode')
    .optional()
    .trim()
    .matches(/^\d{4,8}$/).withMessage('HSN code must be 4-8 digits'),
  body('gstRate')
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage('GST rate must be between 0 and 100'),
  body('sellingPrice')
    .isFloat({ min: 0 }).withMessage('Selling price must be a positive number'),
  body('costPrice')
    .optional()
    .isFloat({ min: 0 }).withMessage('Cost price must be a positive number'),
  body('stockQuantity')
    .optional()
    .isInt({ min: 0 }).withMessage('Stock quantity must be a non-negative integer'),
  validate
];

// Sale validations
const createSaleValidation = [
  body('items')
    .isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product')
    .notEmpty().withMessage('Product ID is required')
    .isMongoId().withMessage('Invalid product ID'),
  body('items.*.quantity')
    .isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.price')
    .isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('buyerName')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Buyer name max 200 characters')
    .escape(),
  body('buyerGstin')
    .optional()
    .trim()
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .withMessage('Invalid GSTIN format'),
  body('paymentMode')
    .isIn(['cash', 'card', 'upi', 'bank_transfer', 'credit'])
    .withMessage('Invalid payment mode'),
  validate
];

// Customer/Supplier validations
const createCustomerValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Customer name is required')
    .isLength({ min: 2, max: 200 }).withMessage('Name must be 2-200 characters')
    .escape(),
  body('phone')
    .optional()
    .trim()
    .matches(/^[6-9]\d{9}$/).withMessage('Invalid Indian phone number'),
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('gstin')
    .optional()
    .trim()
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .withMessage('Invalid GSTIN format'),
  validate
];

// Shop update validation
const updateShopValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 }).withMessage('Shop name must be 2-200 characters')
    .escape(),
  body('gstin')
    .optional()
    .trim()
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .withMessage('Invalid GSTIN format'),
  body('phone')
    .optional()
    .trim()
    .matches(/^[6-9]\d{9}$/).withMessage('Invalid Indian phone number'),
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('pincode')
    .optional()
    .trim()
    .matches(/^\d{6}$/).withMessage('Invalid Indian pincode'),
  validate
];

// Query parameter validations
const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    .toInt(),
  validate
];

// MongoDB ID validation
const mongoIdValidation = (paramName = 'id') => [
  param(paramName)
    .notEmpty().withMessage(`${paramName} is required`)
    .isMongoId().withMessage(`Invalid ${paramName}`),
  validate
];

module.exports = {
  validate,
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  createProductValidation,
  createSaleValidation,
  createCustomerValidation,
  updateShopValidation,
  paginationValidation,
  mongoIdValidation
};