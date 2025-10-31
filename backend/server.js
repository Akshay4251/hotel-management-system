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

// ============================================
// ✅ SERVE UPLOADS DIRECTORY
// ============================================
const uploadsPath = path.join(__dirname, 'public/uploads');
console.log('📁 Uploads directory path:', uploadsPath);

// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
  console.log('✅ Created uploads directory');
} else {
  console.log('✅ Uploads directory exists');
  
  // Log uploaded files
  const menuPath = path.join(uploadsPath, 'menu');
  if (fs.existsSync(menuPath)) {
    const files = fs.readdirSync(menuPath);
    console.log(`📸 Found ${files.length} images in menu folder`);
    if (files.length > 0 && files.length <= 5) {
      console.log('   Sample files:', files);
    }
  }
}

// ✅ Serve uploads folder statically
app.use('/uploads', express.static(uploadsPath, {
  maxAge: '1d',
  etag: true,
  lastModified: true
}));

console.log('✅ Static file serving enabled for /uploads');

// ===== SERVE STATIC FILES (PRODUCTION ONLY) =====
if (isProduction) {
  const distPath = path.join(__dirname, 'dist');
  
  console.log('📁 Static files path:', distPath);
  
  if (fs.existsSync(distPath)) {
    console.log('✅ dist folder exists');
    
    const files = fs.readdirSync(distPath);
    console.log('📄 dist contents:', files);
    
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
  
  app.use(express.static(distPath, {
    index: false,
    dotfiles: 'ignore',
    etag: true,
    lastModified: true,
    maxAge: '1d',
    redirect: false
  }));
  
  console.log('✅ Static file middleware enabled for dist');
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
    // Don't serve index.html for API routes or uploads
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
      return res.status(404).json({ error: 'Not found' });
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
  
  if (req.path.startsWith('/api/')) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Internal Server Error',
      ...(isDevelopment && { stack: err.stack })
    });
  }
  
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

// ============================================
// ✅ AUTO-MIGRATION ON STARTUP
// ============================================
const runMigrations = async () => {
  try {
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║  🔧 RUNNING DATABASE MIGRATIONS           ║');
    console.log('╚════════════════════════════════════════════╝\n');
    
    // ============================================
    // Migration 1: Add tableId to Bills table
    // ============================================
    try {
      console.log('🔍 Checking Bills table structure...');
      
      const [columns] = await sequelize.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'Bills' 
          AND column_name = 'tableId';
      `);
      
      if (columns.length === 0) {
        console.log('📝 Migration needed: Adding tableId column to Bills table');
        
        // Step 1: Add column
        console.log('   Step 1/3: Adding column...');
        await sequelize.query(`
          ALTER TABLE "Bills" 
          ADD COLUMN "tableId" UUID;
        `);
        console.log('   ✅ Column added');
        
        // Step 2: Update existing bills
        console.log('   Step 2/3: Updating existing bills...');
        const [updateResult] = await sequelize.query(`
          UPDATE "Bills" 
          SET "tableId" = "Orders"."tableId"
          FROM "Orders"
          WHERE "Bills"."orderId" = "Orders"."id"
            AND "Bills"."tableId" IS NULL;
        `);
        console.log('   ✅ Existing bills updated');
        
        // Step 3: Add foreign key constraint
        console.log('   Step 3/3: Adding foreign key constraint...');
        await sequelize.query(`
          ALTER TABLE "Bills"
          ADD CONSTRAINT "Bills_tableId_fkey"
          FOREIGN KEY ("tableId")
          REFERENCES "Tables"("id")
          ON DELETE RESTRICT
          ON UPDATE CASCADE;
        `);
        console.log('   ✅ Foreign key constraint added');
        
        console.log('✅ Migration completed: Bills.tableId added successfully\n');
      } else {
        console.log('✅ Bills table is up to date (tableId column exists)\n');
      }
    } catch (migrationError) {
      // Check if error is because column already exists
      if (migrationError.message.includes('already exists')) {
        console.log('✅ Bills table is up to date (column already exists)\n');
      } else {
        console.error('⚠️  Bills migration warning:', migrationError.message);
        console.error('    This may not affect functionality if the column already exists.');
        console.error('    Error details:', migrationError.stack);
        console.log('');
      }
    }
    
    // ============================================
    // Add more migrations here in the future
    // ============================================
    
    console.log('╔════════════════════════════════════════════╗');
    console.log('║  ✅ ALL MIGRATIONS COMPLETED              ║');
    console.log('╚════════════════════════════════════════════╝\n');
    
  } catch (error) {
    console.error('╔════════════════════════════════════════════╗');
    console.error('║  ❌ MIGRATION ERROR                       ║');
    console.error('╚════════════════════════════════════════════╝');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.log('');
    console.warn('⚠️  Continuing server startup despite migration error...\n');
  }
};

// ============================================
// START SERVER WITH MIGRATIONS
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
      console.log('║  🏨 Hotel Management System               ║');
      console.log('╚════════════════════════════════════════════╝');
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`✅ Socket.IO: Enabled`);
      console.log(`✅ Uploads: /uploads`);
      if (isProduction) {
        console.log(`✅ Serving: /dist`);
      }
      console.log('╚════════════════════════════════════════════╝');
      console.log(`\n🌐 Access your app at: http://localhost:${PORT}\n`);
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
// START THE APPLICATION
// ============================================
startServer();

module.exports = { app, server, io };