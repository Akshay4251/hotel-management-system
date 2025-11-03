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
const { testConnection } = require('./config/cloudinary');

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
console.log('║  🏨 Hotel Management System               ║');
console.log('╚════════════════════════════════════════════╝');
console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
console.log('🔌 Port:', PORT);
console.log('');

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

// Make io accessible to routes
app.set('io', io);

// ============================================
// MIDDLEWARE CONFIGURATION
// ============================================

// Compression
app.use(compression());

// Body parsing (with increased limits for image upload)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Logging
app.use(morgan(isDevelopment ? 'dev' : 'combined'));

// CORS (Development only)
if (isDevelopment) {
  app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  }));
}

// Security headers (relaxed for static files)
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

// Create directories if they don't exist (for local development)
if (!isProduction && process.env.STORAGE_MODE !== 'cloudinary') {
  [publicPath, uploadsPath, menuUploadsPath].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Created directory: ${dir}`);
    }
  });
}

console.log('📁 Public path:', publicPath);

// Count existing uploads (if using local storage)
if (fs.existsSync(menuUploadsPath)) {
  const files = fs.readdirSync(menuUploadsPath);
  if (files.length > 0) {
    console.log(`📸 Found ${files.length} images in local uploads`);
  }
}

// Serve public folder
app.use(express.static(publicPath, {
  maxAge: isDevelopment ? 0 : '1d',
  etag: true,
  lastModified: true
}));

// Serve uploads with proper headers
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

console.log('✅ Static file serving configured');

// ============================================
// PRODUCTION FRONTEND SERVING
// ============================================
if (isProduction) {
  const distPath = path.join(__dirname, 'dist');
  
  console.log('📦 Checking frontend build:', distPath);
  
  if (fs.existsSync(distPath)) {
    const files = fs.readdirSync(distPath);
    console.log('✅ Frontend build found');
    console.log(`   Files: ${files.join(', ')}`);
    
    // Serve frontend build
    app.use(express.static(distPath, {
      index: false,
      dotfiles: 'ignore',
      etag: true,
      lastModified: true,
      maxAge: '1d'
    }));
    
    console.log('✅ Serving frontend from /dist');
  } else {
    console.warn('⚠️  Frontend build not found - run npm run build in frontend folder');
  }
}

// ============================================
// API ROUTES
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    storage: process.env.STORAGE_MODE || 'local',
    uptime: Math.floor(process.uptime()),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
    }
  });
});

// API root
app.get('/api', (req, res) => {
  res.json({
    message: '🏨 Hotel Management System API',
    version: '2.0.0',
    status: 'running',
    environment: process.env.NODE_ENV || 'development',
    storage: process.env.STORAGE_MODE || 'local',
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

// Debug route for uploads (development only)
if (isDevelopment) {
  app.get('/api/debug/uploads', (req, res) => {
    try {
      const menuPath = path.join(__dirname, 'public/uploads/menu');
      const files = fs.existsSync(menuPath) ? fs.readdirSync(menuPath) : [];
      
      res.json({
        storage: process.env.STORAGE_MODE || 'local',
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
}

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/admin', adminRoutes);

// ============================================
// SPA FALLBACK (PRODUCTION)
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
        <!DOCTYPE html>
        <html>
          <head><title>Error</title></head>
          <body>
            <h1>Application Error</h1>
            <p>Frontend build not found. Please build the frontend:</p>
            <pre>cd frontend && npm run build</pre>
          </body>
        </html>
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
// ERROR HANDLER (GLOBAL)
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
  
  // Multer errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 5MB'
      });
    }
  }
  
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
    console.log('\n╔═��══════════════════════════════════════════╗');
    console.log('║  🔧 RUNNING DATABASE MIGRATIONS           ║');
    console.log('╚════════════════════════════════════════════╝\n');
    
    // Migration 1: Check Bills table structure
    try {
      console.log('🔍 Checking Bills table structure...');
      
      const [currentColumns] = await sequelize.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'Bills'
        ORDER BY ordinal_position;
      `);
      
      const columnNames = currentColumns.map(col => col.column_name);
      console.log(`   Current columns (${columnNames.length}):`, columnNames.slice(0, 5).join(', '), '...');
      
      // Required columns for Bills table
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
      
      // Add missing columns
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
      
      // Update existing bills from orders if needed
      if (migrationsRun > 0) {
        console.log('   📝 Updating existing bills from orders...');
        
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
        
        console.log('   ✅ Bills updated');
      }
      
      if (migrationsRun > 0) {
        console.log(`✅ Bills migration completed: ${migrationsRun} changes applied\n`);
      } else {
        console.log('✅ Bills table is up to date\n');
      }
      
    } catch (migrationError) {
      if (migrationError.message.includes('already exists')) {
        console.log('✅ Bills table is up to date\n');
      } else {
        console.error('⚠️  Bills migration warning:', migrationError.message);
        console.log('   Continuing startup...\n');
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
    console.warn('\n⚠️  Continuing startup despite migration error...\n');
  }
};

// ============================================
// SERVER STARTUP
// ============================================
const startServer = async () => {
  try {
    console.log('╔════════════════════════════════════════════╗');
    console.log('║  🚀 STARTING SERVER                       ║');
    console.log('╚════════════════════════════════════════════╝\n');
    
    // Step 1: Connect to database
    console.log('📊 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected\n');
    
    // Step 2: Test Cloudinary connection if enabled
    if (process.env.STORAGE_MODE === 'cloudinary' || isProduction) {
      console.log('☁️  Testing Cloudinary connection...');
      const cloudinaryConnected = await testConnection();
      if (!cloudinaryConnected && process.env.STORAGE_MODE === 'cloudinary') {
        console.error('⚠️  Cloudinary connection failed but STORAGE_MODE=cloudinary');
        console.error('   Images will not upload correctly!');
      }
      console.log('');
    } else {
      console.log('💾 Using local storage for images\n');
    }
    
    // Step 3: Run database migrations
    await runMigrations();
    
    // Step 4: Start HTTP server
    server.listen(PORT, '0.0.0.0', () => {
      console.log('╔════════════════════════════════════════════╗');
      console.log('║  ✅ SERVER STARTED SUCCESSFULLY           ║');
      console.log('╚════════════════════════════════════════════╝');
      console.log(`🌐 Port: ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📁 Storage: ${process.env.STORAGE_MODE === 'cloudinary' ? 'Cloudinary ☁️' : 'Local 💾'}`);
      console.log(`🔌 Socket.IO: Active`);
      
      if (isProduction) {
        console.log(`📦 Frontend: Serving from /dist`);
      } else {
        console.log(`🔧 Development mode: Frontend on separate port`);
      }
      
      console.log('╚════════════════════════════════════════════╝');
      console.log(`\n🚀 Server ready at: http://localhost:${PORT}`);
      console.log(`📝 API Documentation: http://localhost:${PORT}/api\n`);
    });
    
  } catch (error) {
    console.error('╔════════════════════════════════════════════╗');
    console.error('║  ❌ FAILED TO START SERVER                ║');
    console.error('╚════════════════════════════════════════════╝');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('\nPossible issues:');
    console.error('1. Database connection failed - check DATABASE_URL');
    console.error('2. Port already in use - check PORT env variable');
    console.error('3. Missing environment variables - check .env file');
    console.error('4. Cloudinary credentials invalid - check CLOUDINARY_* variables\n');
    process.exit(1);
  }
};

// ============================================
// START THE APPLICATION
// ============================================
startServer();

// Export for testing
module.exports = { app, server, io };