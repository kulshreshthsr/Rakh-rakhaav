const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config();

const connectDB = require('./config/db');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const hpp = require('hpp');

const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const productRoutes = require('./routes/productRoutes');
const salesRoutes = require('./routes/salesRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const customerRoutes = require('./routes/customerRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const incomeRoutes = require('./routes/incomeRoutes');
const bankEntryRoutes = require('./routes/bankEntryRoutes');
const accountingRoutes = require('./routes/accountingRoutes');
const rbacRoutes = require('./routes/rbacRoutes');
const industryRoutes = require('./routes/industryRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const taskRoutes = require('./routes/taskRoutes');
const auditRoutes = require('./routes/auditRoutes');
const saleReturnRoutes = require('./routes/saleReturnRoutes');
const narcoticsRoutes  = require('./routes/narcoticsRoutes');
const stylistRoutes    = require('./routes/stylistRoutes');
const membershipRoutes = require('./routes/membershipRoutes');
const contractorRoutes = require('./routes/contractorRoutes');
const warrantyRoutes   = require('./routes/warrantyRoutes');
const petRoutes        = require('./routes/petRoutes');
const gstRoutes        = require('./routes/gstRoutes');
const itcRoutes        = require('./routes/itcRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

const configuredOrigins = (process.env.FRONTEND_URLS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const staticAllowedOrigins = [
  'https://rakh-rakhaav-1.onrender.com',
  'http://localhost:3000',
  'http://localhost:3001',
  ...configuredOrigins,
];

const isAllowedOrigin = (origin = '') => {
  if (!origin) return true;
  if (staticAllowedOrigins.includes(origin)) return true;

  try {
    const { hostname } = new URL(origin);
    return (
      hostname.endsWith('.vercel.app') ||
      hostname.endsWith('.onrender.com') ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1'
    );
  } catch {
    return false;
  }
};

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
};

connectDB();

app.use(cors(corsOptions));
app.use(helmet());
app.use(hpp());
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/bank-entries', bankEntryRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/rbac', rbacRoutes);
app.use('/api/industry', industryRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/sale-returns', saleReturnRoutes);
app.use('/api/narcotics', narcoticsRoutes);
app.use('/api/stylists', stylistRoutes);
app.use('/api/memberships', membershipRoutes);
app.use('/api/contractors', contractorRoutes);
app.use('/api/warranty',    warrantyRoutes);
app.use('/api/pets',        petRoutes);
app.use('/api/gst',         gstRoutes);
app.use('/api/itc',         itcRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;