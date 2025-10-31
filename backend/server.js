require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

const { connectDB } = require('./config/database');
const socketHandler = require('./socket/socketHandler');

// Import routes
const authRoutes = require('./routes/authRoutes');
const tableRoutes = require('./routes/tableRoutes');
const menuRoutes = require('./routes/menuRoutes');
const orderRoutes = require('./routes/orderRoutes');
const billRoutes = require('./routes/billRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const server = http.createServer(app);

// ===== ENVIRONMENT =====
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isProduction;

console.log('🌍 Environment:', process.env.NODE_ENV || 'development');

// ===== SOCKET.IO =====
const io = socketIo(server, {
  cors: {
    origin: isDevelopment ? ['http://localhost:5173', 'http://localhost:3000'] : true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"]
  },
  transports: ['websocket', 'polling']
});

// ===== BASIC MIDDLEWARE (BEFORE STATIC FILES) =====
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(isDevelopment ? 'dev' : 'combined'));

// ===== CORS (Development only) =====
if (isDevelopment) {
  app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true
  }));
}

// ===== HELMET (Relaxed for static files) =====
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false
}));

// Make io accessible
app.set('io', io);

// ===== SERVE STATIC FILES (PRODUCTION ONLY - MUST BE EARLY) =====
if (isProduction) {
  const distPath = path.join(__dirname, 'dist');
  
  console.log('📁 Static files path:', distPath);
  
  // Check dist folder
  if (fs.existsSync(distPath)) {
    console.log('✅ dist folder exists');
    
    const files = fs.readdirSync(distPath);
    console.log('📄 dist contents:', files);
    
    // Check assets folder
    const assetsPath = path.join(distPath, 'assets');
    if (fs.existsSync(assetsPath)) {
      const assetFiles = fs.readdirSync(assetsPath);
      console.log('📦 assets folder contains', assetFiles.length, 'files');
    } else {
      console.warn('⚠️  No assets folder found');
    }
  } else {
    console.error('❌ dist folder NOT found at:', distPath);
  }
  
  // Serve static files with NO restrictions
  app.use(express.static(distPath, {
    index: false,  // Don't auto-serve index.html
    dotfiles: 'ignore',
    etag: true,
    lastModified: true,
    maxAge: '1d',
    redirect: false
  }));
  
  console.log('✅ Static file middleware enabled');
}

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime()
  });
});

// ===== DEBUG ENDPOINT =====
app.get('/debug/dist', (req, res) => {
  const distPath = path.join(__dirname, 'dist');
  
  if (!fs.existsSync(distPath)) {
    return res.json({
      exists: false,
      path: distPath
    });
  }
  
  const contents = fs.readdirSync(distPath);
  const assetsPath = path.join(distPath, 'assets');
  let assets = [];
  
  if (fs.existsSync(assetsPath)) {
    assets = fs.readdirSync(assetsPath);
  }
  
  res.json({
    exists: true,
    path: distPath,
    contents: contents,
    assetsCount: assets.length,
    assets: assets.slice(0, 10) // First 10 files
  });
});

// ===== API ROUTES =====
app.get('/api', (req, res) => {
  res.json({
    message: '🏨 Hotel Management API',
    version: '1.0.0',
    status: 'running'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/admin', adminRoutes);

// ===== SPA FALLBACK (MUST BE LAST) =====
if (isProduction) {
  app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API route not found' });
    }
    
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(500).send('Application not built correctly. index.html not found.');
    }
  });
}

// ===== 404 HANDLER (Development) =====
if (isDevelopment) {
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route not found',
      path: req.path
    });
  });
}

// ===== ERROR HANDLER (MUST BE LAST) =====
app.use((err, req, res, next) => {
  console.error('╔════════════════════════════════════╗');
  console.error('║  ❌ ERROR                         ║');
  console.error('╚════════════════════════════════════╝');
  console.error('Path:', req.path);
  console.error('Method:', req.method);
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  
  // For API routes, send JSON
  if (req.path.startsWith('/api/')) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Internal Server Error',
      ...(isDevelopment && { stack: err.stack })
    });
  }
  
  // For other routes
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

// ===== SOCKET.IO =====
socketHandler(io);

// ===== GRACEFUL SHUTDOWN =====
process.on('SIGTERM', () => {
  console.log('SIGTERM received: closing server');
  server.close(() => {
    console.log('Server closed');
  });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log('╔════════════════════════════════════════════╗');
      console.log(`║  🏨 Hotel Management System               ║`);
      console.log(`║  ✅ Server: http://0.0.0.0:${PORT}            ║`);
      console.log(`║  ✅ Environment: ${(process.env.NODE_ENV || 'development').padEnd(22)}║`);
      console.log(`║  ✅ Socket.IO: Enabled                     ║`);
      if (isProduction) {
        console.log(`║  ✅ Serving: /dist                         ║`);
      }
      console.log('╚════════════════════════════════════════════╝');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = { app, server, io };