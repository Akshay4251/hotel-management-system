const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ============================================
// Directory Setup
// ============================================

const createUploadDirs = () => {
  const dirs = [
    path.join(__dirname, '../public'),
    path.join(__dirname, '../public/uploads'),
    path.join(__dirname, '../public/uploads/menu')
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Created directory: ${dir}`);
    }
  });
};

createUploadDirs();

// ============================================
// Multer Storage Configuration
// ============================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../public/uploads/menu');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `menu-${uniqueSuffix}${ext}`;
    cb(null, filename);
  }
});

// ============================================
// File Filter - Images Only
// ============================================

const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const allowedExts = /jpeg|jpg|png|gif|webp/;
  
  const extname = allowedExts.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedMimes.includes(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  }
  
  cb(new Error('Only image files (JPEG, PNG, GIF, WEBP) are allowed'));
};

// ============================================
// Multer Instance
// ============================================

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  }
});

// ============================================
// Helper Functions
// ============================================

const deleteFile = (filePath) => {
  try {
    const fullPath = filePath.startsWith('/') 
      ? path.join(__dirname, '../public', filePath)
      : filePath;

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`✅ Deleted file: ${fullPath}`);
      return true;
    }
    
    console.log(`⚠️  File not found: ${fullPath}`);
    return false;
  } catch (error) {
    console.error('❌ Error deleting file:', error.message);
    return false;
  }
};

const getImageUrl = (filename) => {
  return `/uploads/menu/${filename}`;
};

module.exports = {
  upload,
  deleteFile,
  getImageUrl
};