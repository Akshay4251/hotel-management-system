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

const { connectDB, sequelize } = require('./config/database');
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

// ============================================
// ENVIRONMENT CONFIGURATION
// ============================================
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isProduction;
const PORT = process.env.PORT || 5000;

console.log('╔════════════════════════════════════════════╗');
console.log('║  🏨 Hotel Management System - Starting... ║');
console.log('╚════════════════════════════════════════════╝');
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔌 Port: ${PORT}`);

// ============================================
// SOCKET.IO CONFIGURATION
// ============================================
const io = socketIo(server, {
  cors: {
    origin: isDevelopment 
      ? ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174']
      : true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"]
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

app.set('io', io);

// ============================================
// BASIC MIDDLEWARE (ORDER MATTERS!)
// ============================================

// 1. Compression
app.use(compression());

// 2. Body parsers (BEFORE routes)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 3. Logging
if (isDevelopment) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// 4. CORS (Development)
if (isDevelopment) {
  app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  }));
}

// 5. Security Headers (Relaxed for static files)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// ============================================
// STATIC FILE SERVING - UPLOADS
// ============================================
const publicPath = path.join(__dirname, 'public');
const uploadsPath = path.join(__dirname, 'public/uploads');
const menuUploadsPath = path.join(__dirname, 'public/uploads/menu');

// Ensure directories exist
[publicPath, uploadsPath, menuUploadsPath].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});

console.log('📁 Uploads path:', uploadsPath);

// Count existing uploads
if (fs.existsSync(menuUploadsPath)) {
  const files = fs.readdirSync(menuUploadsPath);
  console.log(`📸 Found ${files.length} images in menu uploads`);
  if (files.length > 0 && files.length <= 3) {
    console.log('   Sample:', files.slice(0, 3).join(', '));
  }
}

// Serve public folder
app.use(express.static(publicPath, {
  maxAge: isDevelopment ? 0 : '1d',
  etag: true,
  lastModified: true
}));

// Explicit uploads route with CORS headers
app.use('/uploads', (req, res, next) => {
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Cache-Control', isDevelopment ? 'no-cache' : 'public, max-age=86400');
  next();
}, express.static(uploadsPath, {
  maxAge: isDevelopment ? 0 : '1d',
  etag: true,
  lastModified: true,
  fallthrough: true
}));

console.log('✅ Static file serving configured for /uploads');

// ============================================
// PRODUCTION FRONTEND SERVING
// ============================================
if (isProduction) {
  const distPath = path.join(__dirname, 'dist');
  
  console.log('📁 Checking dist folder:', distPath);
  
  if (fs.existsSync(distPath)) {
    const files = fs.readdirSync(distPath);
    console.log('✅ dist folder exists');
    console.log(`   Contains: ${files.join(', ')}`);
    
    const assetsPath = path.join(distPath, 'assets');
    if (fs.existsSync(assetsPath)) {
      const assetFiles = fs.readdirSync(assetsPath);
      console.log(`   📦 assets: ${assetFiles.length} files`);
    }
    
    // Serve static files from dist
    app.use(express.static(distPath, {
      index: false,
      dotfiles: 'ignore',
      etag: true,
      lastModified: true,
      maxAge: '1d'
    }));
    
    console.log('✅ Serving frontend from /dist');
  } else {
    console.warn('⚠️  dist folder NOT found - frontend will not be served');
  }
}

// ============================================
// HEALTH CHECK & DEBUG ROUTES
// ============================================
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: Math.floor(process.uptime()),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
    }
  });
});

// Debug route for checking uploads
app.get('/api/debug/uploads', (req, res) => {
  try {
    const menuPath = path.join(__dirname, 'public/uploads/menu');
    const files = fs.existsSync(menuPath) 
      ? fs.readdirSync(menuPath)
      : [];
    
    res.json({
      uploadsPath: menuPath,
      exists: fs.existsSync(menuPath),
      fileCount: files.length,
      files: files.slice(0, 10),
      sampleUrls: files.slice(0, 3).map(f => `/uploads/menu/${f}`)
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================
// API ROUTES
// ============================================
app.get('/api', (req, res) => {
  res.json({
    message: '🏨 Hotel Management System API',
    version: '2.0.0',
    status: 'running',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      auth: '/api/auth',
      tables: '/api/tables',
      menu: '/api/menu',
      orders: '/api/orders',
      bills: '/api/bills',
      admin: '/api/admin'
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/admin', adminRoutes);

// ============================================
// SPA FALLBACK (PRODUCTION ONLY - MUST BE LAST)
// ============================================
if (isProduction) {
  app.get('*', (req, res) => {
    // Don't serve index.html for API routes or uploads
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
      return res.status(404).json({ 
        success: false, 
        message: 'Not found',
        path: req.path
      });
    }
    
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(500).send(`
        <h1>Application Error</h1>
        <p>index.html not found. Please rebuild the frontend:</p>
        <pre>cd frontend && npm run build</pre>
      `);
    }
  });
}

// ============================================
// 404 HANDLER (DEVELOPMENT)
// ============================================
if (isDevelopment) {
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route not found',
      path: req.path,
      method: req.method
    });
  });
}

// ============================================
// ERROR HANDLER (MUST BE LAST)
// ============================================
app.use((err, req, res, next) => {
  console.error('╔════════════════════════════════════╗');
  console.error('║  ❌ ERROR OCCURRED                ║');
  console.error('╚════════════════════════════════════╝');
  console.error('Path:', req.path);
  console.error('Method:', req.method);
  console.error('Error:', err.message);
  if (isDevelopment) {
    console.error('Stack:', err.stack);
  }
  console.error('');
  
  const statusCode = err.status || err.statusCode || 500;
  
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(isDevelopment && { 
      stack: err.stack,
      details: err
    })
  });
});

// ============================================
// SOCKET.IO INITIALIZATION
// ============================================
socketHandler(io);

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received: closing server gracefully...`);
  
  server.close(() => {
    console.log('✅ HTTP server closed');
    
    sequelize.close().then(() => {
      console.log('✅ Database connection closed');
      process.exit(0);
    }).catch(err => {
      console.error('❌ Error closing database:', err);
      process.exit(1);
    });
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('⚠️  Forcing shutdown...');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================
// DATABASE MIGRATIONS
// ============================================
const runMigrations = async () => {
  try {
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║  🔧 RUNNING DATABASE MIGRATIONS           ║');
    console.log('╚════════════════════════════════════════════╝\n');
    
    // Migration 1: Bills table structure
    try {
      console.log('🔍 Checking Bills table...');
      
      const [currentColumns] = await sequelize.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'Bills'
        ORDER BY ordinal_position;
      `);
      
      const columnNames = currentColumns.map(col => col.column_name);
      console.log(`   Current columns (${columnNames.length}):`, columnNames.join(', '));
      
      const requiredColumns = {
        tableId: { type: 'UUID', nullable: true },
        taxAmount: { type: 'DECIMAL(10,2)', nullable: false, default: 0 },
        subtotal: { type: 'DECIMAL(10,2)', nullable: false, default: 0 },
        discount: { type: 'DECIMAL(10,2)', nullable: true, default: 0 },
        totalAmount: { type: 'DECIMAL(10,2)', nullable: false },
        isPaid: { type: 'BOOLEAN', nullable: true, default: false },
        paymentMethod: { type: 'VARCHAR', nullable: true },
        paidAmount: { type: 'DECIMAL(10,2)', nullable: true },
        paidAt: { type: 'TIMESTAMP', nullable: true }
      };
      
      let migrationsRun = 0;
      
      for (const [columnName, config] of Object.entries(requiredColumns)) {
        if (!columnNames.includes(columnName)) {
          console.log(`   📝 Adding column: ${columnName}`);
          
          let sql = `ALTER TABLE "Bills" ADD COLUMN "${columnName}" ${config.type}`;
          
          if (config.default !== undefined) {
            sql += typeof config.default === 'string' 
              ? ` DEFAULT '${config.default}'`
              : ` DEFAULT ${config.default}`;
          }
          
          if (!config.nullable) {
            sql += ` NOT NULL`;
          }
          
          await sequelize.query(sql);
          console.log(`   ✅ Added: ${columnName}`);
          migrationsRun++;
        }
      }
      
      // Update existing bills
      if (migrationsRun > 0) {
        console.log('   📝 Updating existing bills...');
        
        await sequelize.query(`
          UPDATE "Bills" b
          SET 
            "tableId" = COALESCE(b."tableId", o."tableId"),
            "subtotal" = COALESCE(b."subtotal", o."subtotal", 0),
            "taxAmount" = COALESCE(b."taxAmount", o."tax", 0),
            "discount" = COALESCE(b."discount", o."discount", 0),
            "totalAmount" = COALESCE(b."totalAmount", o."total", 0)
          FROM "Orders" o
          WHERE b."orderId" = o."id"
            AND (b."tableId" IS NULL OR b."subtotal" = 0);
        `);
        
        console.log('   ✅ Existing bills updated');
      }
      
      if (migrationsRun > 0) {
        console.log(`✅ Bills migration: ${migrationsRun} changes applied\n`);
      } else {
        console.log('✅ Bills table up to date\n');
      }
      
    } catch (migrationError) {
      if (migrationError.message.includes('already exists')) {
        console.log('✅ Bills table up to date\n');
      } else {
        console.error('⚠️  Bills migration warning:', migrationError.message);
        console.log('   Continuing...\n');
      }
    }
    
    console.log('╔════════════════════════════════════════════╗');
    console.log('║  ✅ MIGRATIONS COMPLETED                  ║');
    console.log('╚════════════════════════════════════════════╝\n');
    
  } catch (error) {
    console.error('╔════════════════════════════════════════════╗');
    console.error('║  ❌ MIGRATION ERROR                       ║');
    console.error('╚════════════════════════════════════════════╝');
    console.error('Error:', error.message);
    console.warn('\n⚠️  Continuing startup...\n');
  }
};

// ============================================
// START SERVER
// ============================================
const startServer = async () => {
  try {
    // Step 1: Connect to database
    await connectDB();
    
    // Step 2: Run migrations
    await runMigrations();
    
    // Step 3: Start HTTP server
    server.listen(PORT, '0.0.0.0', () => {
      console.log('╔════════════════════════════════════════════╗');
      console.log('║  ✅ SERVER STARTED SUCCESSFULLY           ║');
      console.log('╚════════════════════════════════════════════╝');
      console.log(`🌐 Port: ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔌 Socket.IO: Active`);
      console.log(`📁 Uploads: /uploads`);
      if (isProduction) {
        console.log(`📦 Frontend: /dist`);
      }
      console.log('╚════════════════════════════════════════════╝');
      console.log(`\n🚀 Access at: http://localhost:${PORT}\n`);
    });
  } catch (error) {
    console.error('╔════════════════════════════════════════════╗');
    console.error('║  ❌ FAILED TO START SERVER                ║');
    console.error('╚════════════════════════════════════════════╝');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
};

// ============================================
// RUN
// ============================================
startServer();

module.exports = { app, server, io };