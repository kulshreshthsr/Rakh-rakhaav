const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendVerificationEmail = async (email, name, token) => {
  const url = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
  await transporter.sendMail({
    from: `"रखरखाव" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Verify your email — रखरखाव',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f5f5f0;border-radius:16px">
        <div style="text-align:center;margin-bottom:24px">
          <div style="font-size:28px;font-weight:800;color:#1a1a2e">रख<span style="color:#6366f1">रखाव</span></div>
          <div style="color:#9ca3af;font-size:13px">Inventory Manager</div>
        </div>
        <div style="background:#fff;border-radius:12px;padding:24px">
          <h2 style="color:#1a1a2e;margin-bottom:8px">Hi ${name}! 👋</h2>
          <p style="color:#6b7280;font-size:14px;line-height:1.6">Please verify your email address to activate your account.</p>
          <a href="${url}" style="display:block;text-align:center;background:#6366f1;color:#fff;padding:14px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;margin:20px 0">Verify Email →</a>
          <p style="color:#9ca3af;font-size:12px;text-align:center">Link expires in 24 hours. If you didn't sign up, ignore this email.</p>
        </div>
      </div>
    `,
  });
};

const sendPasswordResetEmail = async (email, name, token) => {
  const url = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
  await transporter.sendMail({
    from: `"रखरखाव" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Reset your password — रखरखाव',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f5f5f0;border-radius:16px">
        <div style="text-align:center;margin-bottom:24px">
          <div style="font-size:28px;font-weight:800;color:#1a1a2e">रख<span style="color:#6366f1">रखाव</span></div>
          <div style="color:#9ca3af;font-size:13px">Inventory Manager</div>
        </div>
        <div style="background:#fff;border-radius:12px;padding:24px">
          <h2 style="color:#1a1a2e;margin-bottom:8px">Password Reset 🔐</h2>
          <p style="color:#6b7280;font-size:14px;line-height:1.6">Hi ${name}, click below to reset your password.</p>
          <a href="${url}" style="display:block;text-align:center;background:#ef4444;color:#fff;padding:14px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;margin:20px 0">Reset Password →</a>
          <p style="color:#9ca3af;font-size:12px;text-align:center">Link expires in 1 hour. If you didn't request this, ignore this email.</p>
        </div>
      </div>
    `,
  });
};

const sendLowStockAlert = async (email, shopName, products) => {
  const productRows = products.map(p => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #f3f4f6;font-weight:600">${p.name}</td>
      <td style="padding:10px;border-bottom:1px solid #f3f4f6;color:${p.quantity === 0 ? '#ef4444' : '#f59e0b'};font-weight:700">${p.quantity === 0 ? 'OUT OF STOCK' : `${p.quantity} left`}</td>
    </tr>
  `).join('');

  await transporter.sendMail({
    from: `"रखरखाव" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `⚠️ Low Stock Alert — ${shopName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f5f5f0;border-radius:16px">
        <div style="text-align:center;margin-bottom:24px">
          <div style="font-size:28px;font-weight:800;color:#1a1a2e">रख<span style="color:#6366f1">रखाव</span></div>
        </div>
        <div style="background:#fff;border-radius:12px;padding:24px">
          <h2 style="color:#92400e;margin-bottom:8px">⚠️ Low Stock Alert</h2>
          <p style="color:#6b7280;font-size:14px;margin-bottom:16px">The following products need restocking in <strong>${shopName}</strong>:</p>
          <table style="width:100%;border-collapse:collapse">
            <thead><tr><th style="padding:10px;background:#f9f9f7;text-align:left;font-size:11px;text-transform:uppercase;color:#9ca3af">Product</th><th style="padding:10px;background:#f9f9f7;text-align:left;font-size:11px;text-transform:uppercase;color:#9ca3af">Stock</th></tr></thead>
            <tbody>${productRows}</tbody>
          </table>
          <a href="${process.env.CLIENT_URL}/product" style="display:block;text-align:center;background:#f59e0b;color:#fff;padding:12px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;margin-top:20px">Manage Stock →</a>
        </div>
      </div>
    `,
  });
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendLowStockAlert };