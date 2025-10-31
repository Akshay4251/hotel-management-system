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

// ===== ENVIRONMENT DETECTION =====
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isProduction;

// ===== FRONTEND URL CONFIGURATION =====
const FRONTEND_URLS = isDevelopment 
  ? [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000'
    ]
  : [
      process.env.FRONTEND_URL || 'https://your-app.onrender.com'
    ];

console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
console.log('🔗 Allowed Origins:', FRONTEND_URLS);

// ===== SOCKET.IO CONFIGURATION =====
const io = socketIo(server, {
  cors: {
    origin: function(origin, callback) {
      // Allow requests with no origin (mobile apps, Postman, curl)
      if (!origin) return callback(null, true);
      
      if (FRONTEND_URLS.includes(origin) || isDevelopment) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// ===== CORS CONFIGURATION =====
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (FRONTEND_URLS.includes(origin) || isDevelopment) {
      callback(null, true);
    } else {
      console.log('❌ Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Disposition']
};

// Apply CORS before other middleware
app.use(cors(corsOptions));

// Additional CORS headers for all responses
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (FRONTEND_URLS.includes(origin) || isDevelopment)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.header('Access-Control-Expose-Headers', 'Content-Disposition');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ===== SECURITY MIDDLEWARE =====
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

// ===== OTHER MIDDLEWARE =====
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(isDevelopment ? 'dev' : 'combined'));

// Make io accessible to routes
app.set('io', io);

// ===== SERVE STATIC FRONTEND IN PRODUCTION =====
if (isProduction) {
  const frontendPath = path.join(__dirname, 'dist');
  app.use(express.static(frontendPath));
  console.log('📁 Serving static files from:', frontendPath);
}

// ===== API ROUTES =====
app.use('/api/auth', authRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/admin', adminRoutes);

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

app.get('/api', (req, res) => {
  res.json({
    message: '🏨 Hotel Management API',
    version: '1.0.0',
    status: 'running'
  });
});

// ===== SERVE FRONTEND (Must be AFTER API routes) =====
if (isProduction) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
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

// ===== ERROR HANDLING MIDDLEWARE =====
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(isDevelopment && { stack: err.stack })
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