const express = require('express');
const router = express.Router();
const { MenuItem } = require('../models');

// Get all menu items
router.get('/', async (req, res) => {
  try {
    const { category, isVeg, available } = req.query;
    const where = {};
    
    if (category) where.category = category;
    if (isVeg !== undefined) where.isVeg = isVeg === 'true';
    if (available !== undefined) where.isAvailable = available === 'true';
    
    const menuItems = await MenuItem.findAll({ where });
    res.json({ success: true, data: menuItems });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get menu categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await MenuItem.findAll({
      attributes: ['category'],
      group: ['category']
    });
    
    res.json({ 
      success: true, 
      data: categories.map(c => c.category) 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create menu item (admin only)
router.post('/', async (req, res) => {
  try {
    const menuItem = await MenuItem.create(req.body);
    res.status(201).json({ success: true, data: menuItem });
  } catch (error) {
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
    
    const io = req.app.get('io');
    io.emit('menu-updated', menuItem);
    
    res.json({ success: true, data: menuItem });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;