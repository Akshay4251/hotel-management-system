const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// ============================================
// CLOUDINARY CONFIGURATION
// ============================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ============================================
// TEST CONNECTION FUNCTION
// ============================================
const testConnection = async () => {
  try {
    const result = await cloudinary.api.ping();
    console.log('✅ Cloudinary connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Cloudinary connection failed:', error.message);
    console.error('   Please check your CLOUDINARY environment variables');
    return false;
  }
};

// ============================================
// EXTRACT PUBLIC_ID FROM CLOUDINARY URL
// ============================================
const extractPublicId = (url) => {
  if (!url || !url.includes('cloudinary.com')) {
    return null;
  }

  try {
    // Extract the public_id from the URL
    // Format: https://res.cloudinary.com/{cloud}/image/upload/v{version}/{folder}/{public_id}.{ext}
    const parts = url.split('/');
    const uploadIndex = parts.indexOf('upload');
    
    if (uploadIndex === -1) return null;
    
    // Get everything after 'upload/v{version}/'
    const afterUpload = parts.slice(uploadIndex + 2).join('/');
    
    // Remove file extension
    const publicId = afterUpload.replace(/\.[^/.]+$/, '');
    
    return publicId;
  } catch (error) {
    console.error('Error extracting public_id:', error);
    return null;
  }
};

// ============================================
// ✅ MULTER CONFIGURATION (MEMORY STORAGE)
// ============================================
const storage = multer.memoryStorage();

const uploadMenu = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// ============================================
// ✅ UPLOAD TO CLOUDINARY (BUFFER)
// ============================================
const uploadToCloudinary = (buffer, originalname) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'restaurant/menu',
        resource_type: 'image',
        transformation: [
          { width: 800, height: 800, crop: 'limit' },
          { quality: 'auto:good' },
          { fetch_format: 'auto' }
        ]
      },
      (error, result) => {
        if (error) {
          console.error('❌ Cloudinary upload error:', error);
          reject(error);
        } else {
          console.log('✅ Uploaded to Cloudinary:', result.secure_url);
          resolve(result);
        }
      }
    );

    // Write buffer to stream
    uploadStream.end(buffer);
  });
};

// ============================================
// ✅ DELETE FROM CLOUDINARY
// ============================================
const deleteImage = async (imageUrl) => {
  try {
    if (!imageUrl) {
      return { success: false, message: 'No image URL provided' };
    }

    // Use existing extractPublicId function
    const publicId = extractPublicId(imageUrl);

    if (!publicId) {
      console.warn('⚠️  Not a valid Cloudinary URL:', imageUrl);
      return { success: false, message: 'Not a Cloudinary URL' };
    }

    console.log('🗑️  Deleting from Cloudinary:', publicId);

    const result = await cloudinary.uploader.destroy(publicId);
    
    console.log('✅ Cloudinary delete result:', result);

    return { 
      success: result.result === 'ok', 
      message: result.result === 'ok' ? 'Image deleted successfully' : 'Image not found',
      result 
    };
  } catch (error) {
    console.error('❌ Cloudinary delete error:', error);
    return { 
      success: false, 
      message: error.message 
    };
  }
};

// ============================================
// EXPORTS
// ============================================
module.exports = {
  cloudinary,
  testConnection,
  extractPublicId,
  uploadMenu,           // ✅ Added
  uploadToCloudinary,   // ✅ Added
  deleteImage           // ✅ Added
};