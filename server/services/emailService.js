const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendOTPEmail = async (email, name, otp) => {
  await transporter.sendMail({
    from: '"रखरखाव" <guptatarun52778@gmail.com>',
    to: email,
    subject: `${otp} is your रखरखाव verification code`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f5f5f0;border-radius:16px">
        <div style="text-align:center;margin-bottom:24px">
          <div style="font-size:28px;font-weight:800;color:#1a1a2e">रख<span style="color:#6366f1">रखाव</span></div>
          <div style="color:#9ca3af;font-size:13px">Inventory Manager</div>
        </div>
        <div style="background:#fff;border-radius:12px;padding:24px;text-align:center">
          <h2 style="color:#1a1a2e;margin-bottom:8px">Hi ${name}! 👋</h2>
          <p style="color:#6b7280;font-size:14px">Your verification code is:</p>
          <div style="font-size:48px;font-weight:800;color:#6366f1;letter-spacing:12px;margin:24px 0">${otp}</div>
          <p style="color:#9ca3af;font-size:12px">This code expires in 10 minutes. Do not share it with anyone.</p>
        </div>
      </div>
    `,
  });
};

const sendPasswordResetEmail = async (email, name, otp) => {
  await transporter.sendMail({
    from: '"रखरखाव" <guptatarun52778@gmail.com>',
    to: email,
    subject: `${otp} is your password reset code`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f5f5f0;border-radius:16px">
        <div style="background:#fff;border-radius:12px;padding:24px;text-align:center">
          <h2 style="color:#1a1a2e">Password Reset 🔐</h2>
          <p style="color:#6b7280;font-size:14px">Hi ${name}, your reset code is:</p>
          <div style="font-size:48px;font-weight:800;color:#ef4444;letter-spacing:12px;margin:24px 0">${otp}</div>
          <p style="color:#9ca3af;font-size:12px">Expires in 10 minutes.</p>
        </div>
      </div>
    `,
  });
};

const sendLowStockAlert = async (email, shopName, products) => {
  const productRows = products.map(p => `<tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;font-weight:600">${p.name}</td><td style="padding:10px;color:${p.quantity === 0 ? '#ef4444' : '#f59e0b'};font-weight:700">${p.quantity === 0 ? 'OUT OF STOCK' : `${p.quantity} left`}</td></tr>`).join('');
  await transporter.sendMail({
    from: '"रखरखाव" <guptatarun52778@gmail.com>',
    to: email,
    subject: `⚠️ Low Stock Alert — ${shopName}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px"><div style="background:#fff;border-radius:12px;padding:24px"><h2 style="color:#92400e">⚠️ Low Stock Alert</h2><table style="width:100%"><thead><tr><th style="text-align:left;padding:10px;color:#9ca3af;font-size:11px">PRODUCT</th><th style="text-align:left;padding:10px;color:#9ca3af;font-size:11px">STOCK</th></tr></thead><tbody>${productRows}</tbody></table></div></div>`,
  });
};

module.exports = { sendOTPEmail, sendPasswordResetEmail, sendLowStockAlert };