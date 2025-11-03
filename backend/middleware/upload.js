const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { cloudinary, extractPublicId } = require('../config/cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Determine storage mode
const isProduction = process.env.NODE_ENV === 'production';
const useCloudinary = process.env.STORAGE_MODE === 'cloudinary' || isProduction;

console.log('📁 Storage mode:', useCloudinary ? 'Cloudinary ☁️' : 'Local 💾');

// ============================================
// LOCAL STORAGE (Development only)
// ============================================

const createUploadDirs = () => {
  if (useCloudinary) return;

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

// Local disk storage
const localStorage = multer.diskStorage({
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
// CLOUDINARY STORAGE (Production)
// ============================================

const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'hotel-menu',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      transformation: [
        { width: 1200, height: 1200, crop: 'limit' },
        { quality: 'auto:good' }
      ],
      public_id: `menu-${Date.now()}-${Math.round(Math.random() * 1E9)}`,
      resource_type: 'image'
    };
  }
});

// ============================================
// FILE FILTER
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
// MULTER CONFIGURATION
// ============================================

const upload = multer({
  storage: useCloudinary ? cloudinaryStorage : localStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

// Delete file from storage
const deleteFile = async (filePath) => {
  try {
    if (!filePath) return false;

    if (useCloudinary) {
      // Delete from Cloudinary
      if (filePath.includes('cloudinary.com')) {
        const publicId = extractPublicId(filePath);
        if (!publicId) return false;

        const result = await cloudinary.uploader.destroy(publicId);
        console.log('✅ Deleted from Cloudinary:', publicId);
        return result.result === 'ok';
      }
      return false;
    } else {
      // Delete from local storage
      const fullPath = filePath.startsWith('/') 
        ? path.join(__dirname, '../public', filePath)
        : filePath;

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`✅ Deleted local file: ${fullPath}`);
        return true;
      }
      return false;
    }
  } catch (error) {
    console.error('❌ Error deleting file:', error.message);
    return false;
  }
};

// Get image URL from uploaded file
const getImageUrl = (file) => {
  if (!file) return null;

  if (useCloudinary) {
    // Cloudinary provides the full URL
    return file.path || file.secure_url || file.url;
  } else {
    // Local storage returns relative path
    return `/uploads/menu/${file.filename}`;
  }
};

module.exports = {
  upload,
  deleteFile,
  getImageUrl,
  useCloudinary
};