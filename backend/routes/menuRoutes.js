const express = require('express');
const router = express.Router();
const { MenuItem } = require('../models');
const { upload, deleteFile, getImageUrl, useCloudinary } = require('../middleware/upload');

// ============================================
// VALIDATION HELPER
// ============================================

const validateMenuItemData = (data) => {
  const errors = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push('Name is required');
  }

  if (!data.category || data.category.trim().length === 0) {
    errors.push('Category is required');
  }

  if (!data.price || isNaN(parseFloat(data.price)) || parseFloat(data.price) <= 0) {
    errors.push('Valid price is required');
  }

  return errors;
};

// ============================================
// GET ROUTES
// ============================================

// GET /api/menu - Get all menu items
router.get('/', async (req, res) => {
  try {
    const { category, isVeg, available } = req.query;
    const where = {};
    
    if (category) where.category = category;
    if (isVeg !== undefined) where.isVeg = isVeg === 'true';
    if (available !== undefined) where.isAvailable = available === 'true';
    
    const menuItems = await MenuItem.findAll({ 
      where,
      order: [['category', 'ASC'], ['name', 'ASC']]
    });
    
    console.log(`📋 Fetched ${menuItems.length} menu items`);
    
    res.json({ 
      success: true, 
      data: menuItems,
      count: menuItems.length
    });
  } catch (error) {
    console.error('❌ Error fetching menu items:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch menu items',
      error: error.message 
    });
  }
});

// GET /api/menu/categories - Get unique categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await MenuItem.findAll({
      attributes: ['category'],
      group: ['category'],
      raw: true
    });
    
    const categoryList = categories
      .map(c => c.category)
      .filter(Boolean)
      .sort();
    
    res.json({ 
      success: true, 
      data: categoryList
    });
  } catch (error) {
    console.error('❌ Error fetching categories:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch categories',
      error: error.message 
    });
  }
});

// GET /api/menu/:id - Get single menu item
router.get('/:id', async (req, res) => {
  try {
    const menuItem = await MenuItem.findByPk(req.params.id);
    
    if (!menuItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Menu item not found' 
      });
    }
    
    res.json({ success: true, data: menuItem });
  } catch (error) {
    console.error('❌ Error fetching menu item:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch menu item',
      error: error.message 
    });
  }
});

// ============================================
// IMAGE UPLOAD ROUTE
// ============================================

// POST /api/menu/upload-image - Upload image
router.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const imageUrl = getImageUrl(req.file);
    
    console.log('╔═══════════════════════════════════╗');
    console.log('║  ✅ IMAGE UPLOADED               ║');
    console.log('╚═══════════════════════════════════╝');
    console.log('📁 Storage:', useCloudinary ? 'Cloudinary ☁️' : 'Local 💾');
    console.log('🌐 URL:', imageUrl);
    console.log('📦 Size:', (req.file.size / 1024).toFixed(2), 'KB');
    console.log('');
    
    res.json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl,
      storage: useCloudinary ? 'cloudinary' : 'local',
      size: req.file.size
    });
  } catch (error) {
    console.error('╔═══════════════════════════════════╗');
    console.error('║  ❌ IMAGE UPLOAD ERROR           ║');
    console.error('╚═══════════════════════════════════╝');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('Cloudinary Config:', {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME ? 'SET' : 'MISSING',
      apiKey: process.env.CLOUDINARY_API_KEY ? 'SET' : 'MISSING',
      apiSecret: process.env.CLOUDINARY_API_SECRET ? 'SET' : 'MISSING'
    });
    console.error('');
    
    // Try to clean up uploaded file
    if (req.file) {
      try {
        await deleteFile(getImageUrl(req.file));
      } catch (cleanupError) {
        console.error('Failed to cleanup file:', cleanupError.message);
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to upload image',
      error: error.message
    });
  }
});

// ============================================
// CREATE ROUTE
// ============================================

// POST /api/menu - Create menu item
router.post('/', async (req, res) => {
  try {
    console.log('📝 Creating menu item...');
    
    const validationErrors = validateMenuItemData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    const menuItemData = {
      name: req.body.name.trim(),
      category: req.body.category.trim(),
      price: parseFloat(req.body.price),
      description: req.body.description?.trim() || null,
      image: req.body.image || null,
      isAvailable: req.body.isAvailable !== undefined ? Boolean(req.body.isAvailable) : true,
      isVeg: req.body.isVeg !== undefined ? Boolean(req.body.isVeg) : true,
      preparationTime: parseInt(req.body.preparationTime) || 15,
      spiceLevel: req.body.spiceLevel || 'mild',
      allergens: Array.isArray(req.body.allergens) ? req.body.allergens : [],
      tags: Array.isArray(req.body.tags) ? req.body.tags : []
    };

    const menuItem = await MenuItem.create(menuItemData);
    
    console.log('✅ Menu item created:', menuItem.name);
    
    const io = req.app.get('io');
    if (io) {
      io.emit('menu-updated', { action: 'created', data: menuItem });
    }
    
    res.status(201).json({ 
      success: true, 
      message: 'Menu item created successfully',
      data: menuItem 
    });
  } catch (error) {
    console.error('❌ Error creating menu item:', error);
    
    if (req.body.image) {
      try {
        await deleteFile(req.body.image);
      } catch (cleanupError) {
        console.error('Failed to cleanup image:', cleanupError.message);
      }
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create menu item',
      error: error.message
    });
  }
});

// ============================================
// UPDATE ROUTES  
// ============================================

// PUT /api/menu/:id - Update menu item
router.put('/:id', async (req, res) => {
  try {
    const menuItem = await MenuItem.findByPk(req.params.id);
    
    if (!menuItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Menu item not found' 
      });
    }

    console.log('📝 Updating menu item:', menuItem.name);

    const oldImage = menuItem.image;

    const updatedData = {
      name: req.body.name?.trim() || menuItem.name,
      category: req.body.category?.trim() || menuItem.category,
      price: req.body.price !== undefined ? parseFloat(req.body.price) : menuItem.price,
      description: req.body.description !== undefined ? (req.body.description?.trim() || null) : menuItem.description,
      image: req.body.image !== undefined ? req.body.image : menuItem.image,
      isAvailable: req.body.isAvailable !== undefined ? Boolean(req.body.isAvailable) : menuItem.isAvailable,
      isVeg: req.body.isVeg !== undefined ? Boolean(req.body.isVeg) : menuItem.isVeg,
      preparationTime: req.body.preparationTime !== undefined ? parseInt(req.body.preparationTime) : menuItem.preparationTime,
      spiceLevel: req.body.spiceLevel || menuItem.spiceLevel,
      allergens: req.body.allergens || menuItem.allergens,
      tags: req.body.tags || menuItem.tags
    };

    await menuItem.update(updatedData);

    // Delete old image if replaced (non-blocking)
    if (oldImage && req.body.image && oldImage !== req.body.image) {
      console.log('🗑️  Deleting old image...');
      try {
        await deleteFile(oldImage);
        console.log('✅ Old image deleted');
      } catch (deleteError) {
        console.error('⚠️  Failed to delete old image (non-critical):', deleteError.message);
        // Don't fail the update if image deletion fails
      }
    }
    
    console.log('✅ Menu item updated successfully');
    
    const io = req.app.get('io');
    if (io) {
      io.emit('menu-updated', { action: 'updated', data: menuItem });
    }
    
    res.json({ 
      success: true, 
      message: 'Menu item updated successfully',
      data: menuItem 
    });
  } catch (error) {
    console.error('❌ Error updating menu item:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update menu item',
      error: error.message 
    });
  }
});

// PATCH /api/menu/:id/availability - Toggle availability
router.patch('/:id/availability', async (req, res) => {
  try {
    const { isAvailable } = req.body;
    
    if (isAvailable === undefined) {
      return res.status(400).json({
        success: false,
        message: 'isAvailable field is required'
      });
    }

    const menuItem = await MenuItem.findByPk(req.params.id);
    
    if (!menuItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Menu item not found' 
      });
    }
    
    await menuItem.update({ isAvailable: Boolean(isAvailable) });
    
    console.log(`✅ ${menuItem.name} availability: ${menuItem.isAvailable}`);
    
    const io = req.app.get('io');
    if (io) {
      io.emit('menu-updated', { action: 'availability', data: menuItem });
    }
    
    res.json({ 
      success: true, 
      message: 'Availability updated successfully',
      data: menuItem 
    });
  } catch (error) {
    console.error('❌ Error updating availability:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update availability',
      error: error.message 
    });
  }
});

// ============================================
// DELETE ROUTES (SAFE VERSION)
// ============================================

// DELETE /api/menu/:id - Delete menu item
router.delete('/:id', async (req, res) => {
  try {
    const menuItem = await MenuItem.findByPk(req.params.id);
    
    if (!menuItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Menu item not found' 
      });
    }

    const itemName = menuItem.name;
    const itemImage = menuItem.image;

    console.log('╔═══════════════════════════════════╗');
    console.log('║  🗑️  DELETING MENU ITEM          ║');
    console.log('╚═══════════════════════════════════╝');
    console.log('ID:', req.params.id);
    console.log('Name:', itemName);
    console.log('Image:', itemImage || 'NO IMAGE');

    // CRITICAL: Delete from database FIRST (this is the main operation)
    try {
      await menuItem.destroy();
      console.log('✅ Deleted from database');
    } catch (dbError) {
      console.error('❌ Database deletion failed:', dbError.message);
      throw new Error('Failed to delete from database: ' + dbError.message);
    }

    // OPTIONAL: Try to delete associated image (failure is non-critical)
    if (itemImage) {
      console.log('Attempting to delete image:', itemImage);
      
      try {
        // Check if it's a local path or Cloudinary URL
        const isLocalPath = itemImage.startsWith('/uploads/') || itemImage.startsWith('uploads/');
        const isCloudinaryUrl = itemImage.includes('cloudinary.com');
        
        if (isLocalPath && useCloudinary) {
          console.log('⚠️  Old local image path detected (before Cloudinary migration)');
          console.log('   Skipping deletion - file no longer exists on server');
        } else if (isCloudinaryUrl && !useCloudinary) {
          console.log('⚠️  Cloudinary URL but server in local mode');
          console.log('   Skipping deletion');
        } else {
          // Try to delete the image
          const deleted = await deleteFile(itemImage);
          if (deleted) {
            console.log('✅ Image deleted successfully');
          } else {
            console.log('⚠️  Image not found or already deleted');
          }
        }
      } catch (imageError) {
        // Image deletion failed - log but don't fail the whole operation
        console.error('⚠️  Image deletion failed (non-critical):', imageError.message);
        console.error('   Menu item was deleted from database successfully');
      }
    } else {
      console.log('ℹ️  No image to delete');
    }
    
    console.log('✅ Menu item deletion completed successfully');
    console.log('╚═══════════════════════════════════╝\n');
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      try {
        io.emit('menu-updated', { 
          action: 'deleted', 
          id: req.params.id 
        });
      } catch (socketError) {
        console.error('⚠️  Socket emit failed:', socketError.message);
      }
    }
    
    // Send success response
    res.json({ 
      success: true, 
      message: 'Menu item deleted successfully' 
    });

  } catch (error) {
    console.error('╔═══════════════════════════════════╗');
    console.error('║  ❌ DELETE ERROR                 ║');
    console.error('╚═══════════════════════════════════╝');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('╚═══════════════════════════════════╝\n');
    
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to delete menu item',
      error: error.message
    });
  }
});

// POST /api/menu/delete-image - Delete orphaned image
router.post('/delete-image', async (req, res) => {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Image URL is required'
      });
    }

    console.log('🗑️  Deleting orphaned image:', imageUrl);

    const deleted = await deleteFile(imageUrl);

    if (deleted) {
      res.json({
        success: true,
        message: 'Image deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Image not found or already deleted'
      });
    }
  } catch (error) {
    console.error('❌ Image deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete image',
      error: error.message
    });
  }
});

module.exports = router;