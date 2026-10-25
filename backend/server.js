require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Initialize database schema and seeds
require('./database');

const authRoutes = require('./routes/authRoutes');
const faultRoutes = require('./routes/faultRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Uploads directory static serving
const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// Static Frontend Serving
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// Mount REST API Routes
app.use('/api/auth', authRoutes);
app.use('/api/faults', faultRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'Campus Fix REST API',
    timestamp: new Date().toISOString()
  });
});

// Centralized error handler
app.use((err, req, res, next) => {
  if (err.name === 'MulterError') {
    return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
  }
  if (err) {
    console.error('Unhandled server error:', err.message);
    return res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
  }
  next();
});

// Catch-all route for frontend HTML navigation (Express 5 compatible)
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'API route not found' });
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Campus Fix Server successfully started!`);
  console.log(`🌐 Application URL: http://localhost:${PORT}`);
  console.log(`📡 REST API Base:   http://localhost:${PORT}/api`);
  console.log(`=======================================================`);
});

module.exports = app;
