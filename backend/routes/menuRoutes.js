const express = require('express');
const router = express.Router();
const { MenuItem } = require('../models');
const { upload, deleteFile } = require('../middleware/upload');
const path = require('path');

// ======================
// GET Routes
// ======================

// Get all menu items
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
    
    res.json({ success: true, data: menuItems });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get menu categories
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

// Get single menu item by ID
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
    
    res.json({ success: true, data: menuItem });
  } catch (error) {
    console.error('Error fetching menu item:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ======================
// CREATE Routes
// ======================

// Upload image endpoint
router.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    // Return the relative URL path
    const imageUrl = `/uploads/menu/${req.file.filename}`;
    
    console.log('✅ Image uploaded:', imageUrl);
    
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

// Create menu item
router.post('/', async (req, res) => {
  try {
    const menuItemData = {
      name: req.body.name,
      category: req.body.category,
      price: req.body.price,
      description: req.body.description || null,
      image: req.body.image || null,  // Using 'image' field
      isAvailable: req.body.isAvailable !== undefined ? req.body.isAvailable : true,
      isVeg: req.body.isVeg !== undefined ? req.body.isVeg : true,
      preparationTime: req.body.preparationTime || 15,
      spiceLevel: req.body.spiceLevel || 'mild',
      allergens: req.body.allergens || [],
      tags: req.body.tags || []
    };

    const menuItem = await MenuItem.create(menuItemData);
    
    console.log('✅ Menu item created:', menuItem.name);
    
    // Emit socket event
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// ======================
// UPDATE Routes
// ======================

// Update menu item
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

    // Update fields
    const updatedData = {
      name: req.body.name || menuItem.name,
      category: req.body.category || menuItem.category,
      price: req.body.price !== undefined ? req.body.price : menuItem.price,
      description: req.body.description !== undefined ? req.body.description : menuItem.description,
      image: req.body.image !== undefined ? req.body.image : menuItem.image,  // Using 'image' field
      isAvailable: req.body.isAvailable !== undefined ? req.body.isAvailable : menuItem.isAvailable,
      isVeg: req.body.isVeg !== undefined ? req.body.isVeg : menuItem.isVeg,
      preparationTime: req.body.preparationTime || menuItem.preparationTime,
      spiceLevel: req.body.spiceLevel || menuItem.spiceLevel,
      allergens: req.body.allergens || menuItem.allergens,
      tags: req.body.tags || menuItem.tags
    };

    await menuItem.update(updatedData);
    
    console.log('✅ Menu item updated:', menuItem.name);
    
    // Emit socket event
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

// Update menu item availability
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
    
    // Emit socket event
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

// Delete menu item
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

    // Delete associated image if exists
    if (menuItem.image) {
      const imagePath = path.join(__dirname, '../public', menuItem.image);
      deleteFile(imagePath);
    }

    await menuItem.destroy();
    
    console.log('✅ Menu item deleted:', itemName);
    
    // Emit socket event
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

// Delete image
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