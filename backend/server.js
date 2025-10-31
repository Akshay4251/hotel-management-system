require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');

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

// ===== CORS SETUP =====
const FRONTEND_URLS = isDevelopment 
  ? [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000'
    ]
  : [];

// ===== SOCKET.IO =====
const io = socketIo(server, {
  cors: {
    origin: isDevelopment ? FRONTEND_URLS : true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"]
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// ===== CORS MIDDLEWARE =====
if (isDevelopment) {
  app.use(cors({
    origin: FRONTEND_URLS,
    credentials: true
  }));
}

// ===== SECURITY (Modified for serving static files) =====
app.use(helmet({
  contentSecurityPolicy: false,  // Disable CSP for now
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false
}));

// ===== OTHER MIDDLEWARE =====
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(isDevelopment ? 'dev' : 'combined'));

// Make io accessible
app.set('io', io);

// ===== SERVE STATIC FILES IN PRODUCTION (BEFORE API ROUTES) =====
if (isProduction) {
  const distPath = path.join(__dirname, 'dist');
  
  console.log('📁 Serving static files from:', distPath);
  
  // Check if dist exists
  const fs = require('fs');
  if (fs.existsSync(distPath)) {
    console.log('✅ dist directory found');
    console.log('📄 dist contents:', fs.readdirSync(distPath));
  } else {
    console.error('❌ dist directory NOT found at:', distPath);
  }
  
  // Serve static files with proper headers
  app.use(express.static(distPath, {
    maxAge: '1d',
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      // Set proper MIME types
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
      } else if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css; charset=UTF-8');
      } else if (filePath.endsWith('.html')) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
      }
      // Disable X-Content-Type-Options for static files
      res.removeHeader('X-Content-Type-Options');
    }
  }));
}

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime()
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

// ===== SPA FALLBACK (MUST BE LAST - AFTER API ROUTES) =====
if (isProduction) {
  app.get('*', (req, res, next) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api/')) {
      return next();
    }
    
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    
    // Check if file exists
    const fs = require('fs');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('index.html not found');
    }
  });
}

// ===== 404 HANDLER (Development only) =====
if (isDevelopment) {
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route not found',
      path: req.path
    });
  });
}

// ===== ERROR HANDLER =====
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  
  // Don't send HTML errors for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Internal Server Error',
      ...(isDevelopment && { stack: err.stack })
    });
  }
  
  // For other routes, send JSON error
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

// ===== SOCKET.IO HANDLER =====
socketHandler(io);

// ===== GRACEFUL SHUTDOWN =====
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
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
        console.log(`║  ✅ Frontend: Serving from /dist           ║`);
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