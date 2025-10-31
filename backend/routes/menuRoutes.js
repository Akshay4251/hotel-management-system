const express = require('express');
const router = express.Router();
const { MenuItem } = require('../models');
const { upload, deleteFile } = require('../middleware/upload');
const path = require('path');

// ======================
// GET Routes
// ======================

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
    
    // ✅ Debug logging
    console.log(`📋 Fetched ${menuItems.length} menu items`);
    menuItems.forEach(item => {
      if (item.image) {
        console.log(`  ✅ ${item.name}: ${item.image}`);
      } else {
        console.log(`  ❌ ${item.name}: NO IMAGE`);
      }
    });
    
    res.json({ success: true, data: menuItems });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const categories = await MenuItem.findAll({
      attributes: ['category'],
      group: ['category'],
      raw: true
    });
    
    res.json({ 
      success: true, 
      data: categories.map(c => c.category).filter(Boolean)
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const menuItem = await MenuItem.findByPk(id);
    
    if (!menuItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Menu item not found' 
      });
    }
    
    console.log(`📄 Retrieved: ${menuItem.name}, Image: ${menuItem.image || 'NONE'}`);
    
    res.json({ success: true, data: menuItem });
  } catch (error) {
    console.error('Error fetching menu item:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ======================
// CREATE Routes
// ======================

// ✅ IMPROVED: Upload image endpoint
router.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const imageUrl = `/uploads/menu/${req.file.filename}`;
    
    console.log('╔════════════════════════════════════╗');
    console.log('║  ✅ IMAGE UPLOADED                ║');
    console.log('╚════════════════════════════════════╝');
    console.log('📁 Filename:', req.file.filename);
    console.log('📍 Path:', req.file.path);
    console.log('🌐 URL:', imageUrl);
    console.log('📦 Size:', (req.file.size / 1024).toFixed(2), 'KB');
    console.log('');
    
    res.json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl: imageUrl,
      filename: req.file.filename,
      size: req.file.size
    });
  } catch (error) {
    console.error('❌ Image upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload image'
    });
  }
});

// ✅ IMPROVED: Create menu item
router.post('/', async (req, res) => {
  try {
    console.log('╔════════════════════════════════════╗');
    console.log('║  📝 CREATING MENU ITEM            ║');
    console.log('╚════════════════════════════════════╝');
    console.log('Data received:', {
      name: req.body.name,
      category: req.body.category,
      price: req.body.price,
      image: req.body.image
    });
    
    const menuItemData = {
      name: req.body.name,
      category: req.body.category,
      price: parseFloat(req.body.price),
      description: req.body.description || null,
      image: req.body.image || null,
      isAvailable: req.body.isAvailable !== undefined ? req.body.isAvailable : true,
      isVeg: req.body.isVeg !== undefined ? req.body.isVeg : true,
      preparationTime: req.body.preparationTime || 15,
      spiceLevel: req.body.spiceLevel || 'mild',
      allergens: req.body.allergens || [],
      tags: req.body.tags || []
    };

    const menuItem = await MenuItem.create(menuItemData);
    
    console.log('✅ Menu item created successfully');
    console.log('   ID:', menuItem.id);
    console.log('   Name:', menuItem.name);
    console.log('   Image:', menuItem.image || 'NO IMAGE');
    console.log('');
    
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
    res.status(500).json({ 
      success: false, 
      message: error.message,
      details: error.errors ? error.errors.map(e => e.message) : []
    });
  }
});

// ======================
// UPDATE Routes
// ======================

// ✅ IMPROVED: Update menu item
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const menuItem = await MenuItem.findByPk(id);
    
    if (!menuItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Menu item not found' 
      });
    }

    console.log('╔════════════════════════════════════╗');
    console.log('║  📝 UPDATING MENU ITEM            ║');
    console.log('╚════════════════════════════════════╝');
    console.log('Item:', menuItem.name);
    console.log('Old image:', menuItem.image || 'NONE');
    console.log('New image:', req.body.image !== undefined ? req.body.image || 'REMOVED' : 'UNCHANGED');

    const updatedData = {
      name: req.body.name || menuItem.name,
      category: req.body.category || menuItem.category,
      price: req.body.price !== undefined ? parseFloat(req.body.price) : menuItem.price,
      description: req.body.description !== undefined ? req.body.description : menuItem.description,
      // ✅ CRITICAL: Only update image if explicitly provided
      image: req.body.image !== undefined ? req.body.image : menuItem.image,
      isAvailable: req.body.isAvailable !== undefined ? req.body.isAvailable : menuItem.isAvailable,
      isVeg: req.body.isVeg !== undefined ? req.body.isVeg : menuItem.isVeg,
      preparationTime: req.body.preparationTime || menuItem.preparationTime,
      spiceLevel: req.body.spiceLevel || menuItem.spiceLevel,
      allergens: req.body.allergens || menuItem.allergens,
      tags: req.body.tags || menuItem.tags
    };

    await menuItem.update(updatedData);
    
    console.log('✅ Updated successfully');
    console.log('   Final image:', menuItem.image || 'NO IMAGE');
    console.log('');
    
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/:id/availability', async (req, res) => {
  try {
    const { id } = req.params;
    const { isAvailable } = req.body;
    
    const menuItem = await MenuItem.findByPk(id);
    if (!menuItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Menu item not found' 
      });
    }
    
    menuItem.isAvailable = isAvailable;
    await menuItem.save();
    
    console.log(`✅ ${menuItem.name} availability: ${isAvailable}`);
    
    const io = req.app.get('io');
    if (io) {
      io.emit('menu-updated', { action: 'availability', data: menuItem });
    }
    
    res.json({ 
      success: true, 
      message: 'Availability updated',
      data: menuItem 
    });
  } catch (error) {
    console.error('❌ Error updating availability:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ======================
// DELETE Routes
// ======================

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const menuItem = await MenuItem.findByPk(id);
    
    if (!menuItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Menu item not found' 
      });
    }

    const itemName = menuItem.name;
    const itemImage = menuItem.image;

    // Delete associated image if exists
    if (itemImage) {
      const imagePath = path.join(__dirname, '../public', itemImage);
      const deleted = deleteFile(imagePath);
      console.log(deleted ? `✅ Deleted image: ${itemImage}` : `⚠️  Image not found: ${itemImage}`);
    }

    await menuItem.destroy();
    
    console.log('✅ Menu item deleted:', itemName);
    
    const io = req.app.get('io');
    if (io) {
      io.emit('menu-updated', { action: 'deleted', id: id });
    }
    
    res.json({ 
      success: true, 
      message: 'Menu item deleted successfully' 
    });
  } catch (error) {
    console.error('❌ Error deleting menu item:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/delete-image', async (req, res) => {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Image URL is required'
      });
    }

    const imagePath = path.join(__dirname, '../public', imageUrl);
    const deleted = deleteFile(imagePath);

    if (deleted) {
      res.json({
        success: true,
        message: 'Image deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }
  } catch (error) {
    console.error('❌ Image deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete image'
    });
  }
});

module.exports = router;