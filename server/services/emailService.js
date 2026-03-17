const Brevo = require('@getbrevo/brevo');

const client = Brevo.ApiClient.instance;
client.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;

const apiInstance = new Brevo.TransactionalEmailsApi();

const sendOTPEmail = async (email, name, otp) => {
  const sendSmtpEmail = new Brevo.SendSmtpEmail();
  sendSmtpEmail.to = [{ email, name }];
  sendSmtpEmail.sender = { name: 'रखरखाव', email: 'kulshreshthasrivas@gmail.com' };
  sendSmtpEmail.subject = `${otp} is your रखरखाव verification code`;
  sendSmtpEmail.htmlContent = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f5f5f0;border-radius:16px">
      <div style="text-align:center;margin-bottom:24px">
        <div style="font-size:28px;font-weight:800;color:#1a1a2e">रख<span style="color:#6366f1">रखाव</span></div>
        <div style="color:#9ca3af;font-size:13px">Inventory Manager</div>
      </div>
      <div style="background:#fff;border-radius:12px;padding:24px;text-align:center">
        <h2 style="color:#1a1a2e;margin-bottom:8px">Hi ${name}! 👋</h2>
        <p style="color:#6b7280;font-size:14px">Your verification code is:</p>
        <div style="font-size:48px;font-weight:800;color:#6366f1;letter-spacing:12px;margin:24px 0">${otp}</div>
        <p style="color:#9ca3af;font-size:12px">Expires in 10 minutes. Do not share it with anyone.</p>
      </div>
    </div>
  `;
  await apiInstance.sendTransacEmail(sendSmtpEmail);
};

const sendPasswordResetEmail = async (email, name, otp) => {
  const sendSmtpEmail = new Brevo.SendSmtpEmail();
  sendSmtpEmail.to = [{ email, name }];
  sendSmtpEmail.sender = { name: 'रखरखाव', email: 'kulshreshthasrivas@gmail.com' };
  sendSmtpEmail.subject = `${otp} is your password reset code`;
  sendSmtpEmail.htmlContent = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f5f5f0;border-radius:16px">
      <div style="background:#fff;border-radius:12px;padding:24px;text-align:center">
        <h2 style="color:#1a1a2e">Password Reset 🔐</h2>
        <p style="color:#6b7280;font-size:14px">Hi ${name}, your reset code is:</p>
        <div style="font-size:48px;font-weight:800;color:#ef4444;letter-spacing:12px;margin:24px 0">${otp}</div>
        <p style="color:#9ca3af;font-size:12px">Expires in 10 minutes.</p>
      </div>
    </div>
  `;
  await apiInstance.sendTransacEmail(sendSmtpEmail);
};

const sendLowStockAlert = async (email, shopName, products) => {
  const productRows = products.map(p => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #f3f4f6;font-weight:600">${p.name}</td>
      <td style="padding:10px;color:${p.quantity === 0 ? '#ef4444' : '#f59e0b'};font-weight:700">
        ${p.quantity === 0 ? 'OUT OF STOCK' : `${p.quantity} left`}
      </td>
    </tr>
  `).join('');

  const sendSmtpEmail = new Brevo.SendSmtpEmail();
  sendSmtpEmail.to = [{ email }];
  sendSmtpEmail.sender = { name: 'रखरखाव', email: 'kulshreshthasrivas@gmail.com' };
  sendSmtpEmail.subject = `⚠️ Low Stock Alert — ${shopName}`;
  sendSmtpEmail.htmlContent = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px">
      <div style="background:#fff;border-radius:12px;padding:24px">
        <h2 style="color:#92400e">⚠️ Low Stock Alert</h2>
        <p style="color:#6b7280;font-size:14px">Products needing restock in <strong>${shopName}</strong>:</p>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr>
              <th style="text-align:left;padding:10px;color:#9ca3af;font-size:11px">PRODUCT</th>
              <th style="text-align:left;padding:10px;color:#9ca3af;font-size:11px">STOCK</th>
            </tr>
          </thead>
          <tbody>${productRows}</tbody>
        </table>
      </div>
    </div>
  `;
  await apiInstance.sendTransacEmail(sendSmtpEmail);
};

module.exports = { sendOTPEmail, sendPasswordResetEmail, sendLowStockAlert };