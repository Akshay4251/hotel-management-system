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
    
    console.log('✅ IMAGE UPLOADED SUCCESSFULLY');
    console.log('📁 Storage:', useCloudinary ? 'Cloudinary' : 'Local');
    console.log('🌐 URL:', imageUrl);
    console.log('📦 Size:', (req.file.size / 1024).toFixed(2), 'KB');
    
    res.json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl,
      storage: useCloudinary ? 'cloudinary' : 'local',
      size: req.file.size
    });
  } catch (error) {
    console.error('❌ Image upload error:', error);
    
    if (req.file) {
      await deleteFile(getImageUrl(req.file));
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
      await deleteFile(req.body.image);
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

    // Delete old image if replaced
    if (oldImage && req.body.image && oldImage !== req.body.image) {
      await deleteFile(oldImage);
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
// DELETE ROUTES
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

    await menuItem.destroy();

    // Delete associated image
    if (itemImage) {
      await deleteFile(itemImage);
    }
    
    console.log('✅ Menu item deleted:', itemName);
    
    const io = req.app.get('io');
    if (io) {
      io.emit('menu-updated', { action: 'deleted', id: req.params.id });
    }
    
    res.json({ 
      success: true, 
      message: 'Menu item deleted successfully' 
    });
  } catch (error) {
    console.error('❌ Error deleting menu item:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete menu item',
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


// ADD THIS TEMPORARILY to backend/routes/menuRoutes.js

// Cleanup old menu items with local image paths
router.post('/cleanup-old-images', async (req, res) => {
  try {
    const items = await MenuItem.findAll();
    
    let updated = 0;
    
    for (const item of items) {
      // If image is a local path, set it to null
      if (item.image && item.image.startsWith('/uploads/')) {
        console.log(`Cleaning up ${item.name}: ${item.image} -> null`);
        await item.update({ image: null });
        updated++;
      }
    }
    
    res.json({
      success: true,
      message: `Cleaned up ${updated} menu items with old local image paths`,
      updated
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
module.exports = router;