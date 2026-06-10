const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS } = process.env;
  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) return null;
  _transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: Number(EMAIL_PORT) || 587,
    secure: Number(EMAIL_PORT) === 465,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });
  return _transporter;
}

async function send(to, subject, html) {
  const transport = getTransporter();
  if (!transport) return;
  try {
    await transport.sendMail({ from: process.env.EMAIL_FROM || process.env.EMAIL_USER, to, subject, html });
  } catch (err) {
    logger.error('[emailService] send failed:', err.message);
  }
}

async function sendPasswordResetEmail(to, resetLink) {
  await send(
    to,
    'Rakhaav — Password Reset',
    `<p>Your password reset link (valid 1 hour):</p><p><a href="${resetLink}">${resetLink}</a></p>`
  );
}

async function sendWelcomeEmail(to, name, shopName) {
  await send(
    to,
    `Welcome to Rakhaav — ${shopName}`,
    `<p>नमस्ते ${name}!</p><p>Welcome to Rakhaav. Your shop <strong>${shopName}</strong> is ready.</p>`
  );
}

async function sendUdhaarReminderEmail(to, customerName, amount, shopName) {
  await send(
    to,
    `Payment Reminder — ₹${amount} due`,
    `<p>Dear ${customerName},</p><p>₹${amount} is outstanding at <strong>${shopName}</strong>. Please clear at your earliest. Thank you.</p>`
  );
}

async function sendGSTDeadlineReminderEmail(to, dueDate, gstType) {
  await send(
    to,
    'GST Filing Deadline Reminder',
    `<p>Your ${gstType.toUpperCase()} filing is due on <strong>${dueDate}</strong>. Please file on time to avoid penalties.</p>`
  );
}

async function sendAMCExpiryReminderEmail(to, customerName, productName, expiryDate) {
  await send(
    to,
    `AMC Expiry Reminder — ${productName}`,
    `<p>Dear ${customerName},</p><p>Your AMC for <strong>${productName}</strong> expires on <strong>${expiryDate}</strong>. Please renew to continue coverage.</p>`
  );
}

async function sendWarrantyReadyEmail(to, customerName, productName, jobNumber) {
  await send(
    to,
    `Your ${productName} is Ready for Pickup`,
    `<p>Dear ${customerName},</p><p>Your <strong>${productName}</strong> has been repaired and is ready for pickup. Job Ref: <strong>${jobNumber}</strong>.</p>`
  );
}

module.exports = {
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendUdhaarReminderEmail,
  sendGSTDeadlineReminderEmail,
  sendAMCExpiryReminderEmail,
  sendWarrantyReadyEmail,
};
