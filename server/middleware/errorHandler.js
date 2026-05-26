const errorHandler = (err, req, res, next) => {
  // Invalid MongoDB ObjectId in URL params — return 404 instead of 500
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return res.status(404).json({ success: false, message: 'Resource not found' });
  }
  // MongoDB duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({ success: false, message: `Duplicate value for ${field}` });
  }
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: messages.join(', ') });
  }
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
};
module.exports = errorHandler;