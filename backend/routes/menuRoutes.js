// backend/routes/menuRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { MenuItem } = require('../models');

// Use memory storage instead of disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 // 500KB limit (be conservative)
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// ✅ Upload and convert to base64
router.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    // Convert to base64
    const base64Image = req.file.buffer.toString('base64');
    const dataUri = `data:${req.file.mimetype};base64,${base64Image}`;

    console.log('✅ Image converted to base64');
    console.log('   Size:', (base64Image.length / 1024).toFixed(2), 'KB');

    res.json({
      success: true,
      imageUrl: dataUri, // Return data URI
      size: base64Image.length
    });
  } catch (error) {
    console.error('❌ Image upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload image',
      error: error.message
    });
  }
});

// ✅ Create menu item with base64 image
router.post('/', async (req, res) => {
  try {
    const { name, category, price, description, image, isAvailable } = req.body;

    // Validate
    if (!name || !category || !price) {
      return res.status(400).json({
        success: false,
        message: 'Name, category, and price are required'
      });
    }

    // Create menu item
    const menuItem = await MenuItem.create({
      name,
      category,
      price: parseFloat(price),
      description,
      image, // Store base64 data URI directly
      isAvailable: isAvailable !== undefined ? isAvailable : true
    });

    console.log('✅ Menu item created with image');

    res.status(201).json({
      success: true,
      data: menuItem
    });
  } catch (error) {
    console.error('❌ Create menu item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create menu item',
      error: error.message
    });
  }
});

// ✅ Get menu items (images already in base64)
router.get('/', async (req, res) => {
  try {
    const { category, available } = req.query;
    const where = {};

    if (category) where.category = category;
    if (available !== undefined) where.isAvailable = available === 'true';

    const menuItems = await MenuItem.findAll({
      where,
      order: [['category', 'ASC'], ['name', 'ASC']]
    });

    // Images are already base64, no transformation needed
    res.json({
      success: true,
      data: menuItems
    });
  } catch (error) {
    console.error('❌ Get menu items error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch menu items',
      error: error.message
    });
  }
});

module.exports = router;