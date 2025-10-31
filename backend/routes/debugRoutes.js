const express = require('express');
const router = express.Router();
const { MenuItem, Table, Order, OrderItem } = require('../models');

// ============================================
// PUBLIC DEBUG ENDPOINT (for production)
// ============================================
router.get('/menu-ids', async (req, res) => {
  try {
    const menuItems = await MenuItem.findAll({
      attributes: ['id', 'name', 'category', 'price', 'isAvailable'],
      order: [['name', 'ASC']]
    });
    
    res.json({
      success: true,
      count: menuItems.length,
      items: menuItems.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        price: item.price,
        available: item.isAvailable
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// CHECK SPECIFIC MENU ITEM
// ============================================
router.get('/check-item/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const item = await MenuItem.findByPk(id);
    
    res.json({
      success: true,
      exists: !!item,
      item: item ? {
        id: item.id,
        name: item.name,
        price: item.price,
        available: item.isAvailable
      } : null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// VALIDATE ORDER PAYLOAD
// ============================================
router.post('/validate-order', async (req, res) => {
  try {
    const { tableNumber, items } = req.body;
    
    console.log('🔍 VALIDATING ORDER:');
    console.log('Table:', tableNumber);
    console.log('Items:', items);
    
    const results = {
      table: null,
      items: [],
      errors: [],
      warnings: []
    };
    
    // Check table
    const table = await Table.findOne({ 
      where: { number: parseInt(tableNumber) } 
    });
    
    if (!table) {
      results.errors.push(`Table ${tableNumber} not found`);
      results.table = { exists: false };
    } else {
      results.table = {
        exists: true,
        id: table.id,
        number: table.number,
        status: table.status
      };
    }
    
    // Check each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const menuItemId = item.menuItemId || item.id;
      
      console.log(`Checking item ${i}:`, menuItemId);
      
      const menuItem = await MenuItem.findByPk(menuItemId);
      
      const itemResult = {
        index: i,
        sentId: menuItemId,
        sentQuantity: item.quantity
      };
      
      if (!menuItem) {
        itemResult.exists = false;
        itemResult.error = 'Menu item not found in database';
        results.errors.push(`Item ${i} (${menuItemId}): Not found in database`);
        console.log(`❌ Item ${i}: NOT FOUND`);
      } else {
        itemResult.exists = true;
        itemResult.menuItem = {
          id: menuItem.id,
          name: menuItem.name,
          price: menuItem.price,
          available: menuItem.isAvailable
        };
        
        if (!menuItem.isAvailable) {
          results.warnings.push(`Item ${i} (${menuItem.name}): Not available`);
        }
        
        console.log(`✅ Item ${i}: ${menuItem.name} (${menuItem.id})`);
      }
      
      results.items.push(itemResult);
    }
    
    results.valid = results.errors.length === 0;
    
    console.log('Validation result:', results.valid ? '✅ VALID' : '❌ INVALID');
    
    res.json({
      success: true,
      ...results
    });
    
  } catch (error) {
    console.error('❌ Validation error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;