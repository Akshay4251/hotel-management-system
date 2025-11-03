const express = require('express');
const router = express.Router();
const { MenuItem } = require('../models');
const { uploadMenu, uploadToCloudinary, deleteImage } = require('../config/cloudinary');

// ============================================
// GET ALL MENU ITEMS
// ============================================
router.get('/', async (req, res) => {
  try {
    const { category, available, isVeg } = req.query;
    const where = {};
    
    if (category) where.category = category;
    if (available) where.isAvailable = available === 'true';
    if (isVeg !== undefined) where.isVeg = isVeg === 'true';
    
    const menuItems = await MenuItem.findAll({
      where,
      order: [['category', 'ASC'], ['name', 'ASC']]
    });
    
    res.json({ success: true, data: menuItems });
  } catch (error) {
    console.error('Get menu error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// GET SINGLE MENU ITEM
// ============================================
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
    console.error('Get menu item error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// UPLOAD IMAGE TO CLOUDINARY
// ============================================
router.post('/upload-image', uploadMenu.single('image'), async (req, res) => {
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📤 UPLOADING IMAGE TO CLOUDINARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No image file provided' 
      });
    }

    console.log('File:', req.file.originalname);
    console.log('Size:', (req.file.size / 1024).toFixed(2), 'KB');

    // Upload to Cloudinary
    const result = await uploadToCloudinary(req.file.buffer, req.file.originalname);

    console.log('Cloudinary URL:', result.secure_url);
    console.log('Public ID:', result.public_id);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    res.json({ 
      success: true, 
      imageUrl: result.secure_url,
      publicId: result.public_id,
      message: 'Image uploaded successfully'
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

// ============================================
// CREATE MENU ITEM
// ============================================
router.post('/', async (req, res) => {
  try {
    const { name, category, price, description, isVeg, isAvailable, image } = req.body;
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 CREATING MENU ITEM');
    console.log('Name:', name);
    console.log('Category:', category);
    console.log('Price:', price);
    console.log('Image URL:', image || 'No image');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (!name || !category || !price) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, category, and price are required' 
      });
    }

    const menuItem = await MenuItem.create({
      name,
      category,
      price: parseFloat(price),
      description: description || null,
      isVeg: isVeg !== undefined ? isVeg : true,
      isAvailable: isAvailable !== undefined ? isAvailable : true,
      image: image || null
    });
    
    console.log('✅ Menu item created:', menuItem.id);

    const io = req.app.get('io');
    if (io) {
      io.emit('menu-updated', menuItem);
    }
    
    res.status(201).json({ 
      success: true, 
      data: menuItem,
      message: 'Menu item created successfully'
    });
  } catch (error) {
    console.error('❌ Create menu item error:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ============================================
// UPDATE MENU ITEM
// ============================================
router.put('/:id', async (req, res) => {
  try {
    const menuItem = await MenuItem.findByPk(req.params.id);
    
    if (!menuItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Menu item not found' 
      });
    }

    const oldImage = menuItem.image;
    
    await menuItem.update(req.body);
    
    console.log('✅ Menu item updated:', menuItem.name);

    // Delete old image if new image is provided
    if (req.body.image && oldImage && req.body.image !== oldImage) {
      console.log('🗑️  Deleting old image...');
      try {
        await deleteImage(oldImage);
        console.log('✅ Old image deleted');
      } catch (imageError) {
        console.warn('⚠️  Old image deletion failed:', imageError.message);
      }
    }
    
    const io = req.app.get('io');
    if (io) {
      io.emit('menu-updated', menuItem);
    }
    
    res.json({ 
      success: true, 
      data: menuItem,
      message: 'Menu item updated successfully'
    });
  } catch (error) {
    console.error('❌ Update menu item error:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ============================================
// ✅ DELETE MENU ITEM - HARD DELETE WITH CONFIRMATION
// ============================================
router.delete('/:id', async (req, res) => {
  const { sequelize } = require('../config/database');
  const t = await sequelize.transaction();
  
  try {
    const { force } = req.query;
    
    const menuItem = await MenuItem.findByPk(req.params.id, {
      transaction: t
    });
    
    if (!menuItem) {
      await t.rollback();
      return res.status(404).json({ 
        success: false, 
        message: 'Menu item not found' 
      });
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🗑️  DELETE MENU ITEM REQUEST');
    console.log('   ID:', req.params.id);
    console.log('   Name:', menuItem.name);
    console.log('   Force:', force === 'true' ? 'YES ⚠️' : 'NO');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Check if item is referenced in orders
    const { OrderItem } = require('../models');
    
    const orderItemCount = await OrderItem.count({
      where: { menuItemId: req.params.id },
      transaction: t
    });

    console.log('   Order references:', orderItemCount);

    // ============================================
    // STEP 1: Check if item is used in orders
    // ============================================
    if (orderItemCount > 0 && force !== 'true') {
      await t.rollback();
      
      console.warn('⚠️  DELETION BLOCKED - Item used in orders');
      console.warn('   Requires force=true parameter');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      return res.status(409).json({ 
        success: false, 
        message: `Cannot delete "${menuItem.name}" - it has been ordered ${orderItemCount} time(s)`,
        error_type: 'foreign_key_constraint',
        orderCount: orderItemCount,
        requiresConfirmation: true,
        itemName: menuItem.name,
        hint: 'Use force delete to permanently remove this item and its order references'
      });
    }

    // ============================================
    // STEP 2: Force delete - Remove order references
    // ============================================
    if (orderItemCount > 0 && force === 'true') {
      console.log('⚠️  FORCE DELETE APPROVED');
      console.log('   Permanently deleting', orderItemCount, 'order references...');
      
      const deletedCount = await OrderItem.destroy({
        where: { menuItemId: req.params.id },
        force: true, // Hard delete, not soft delete
        transaction: t
      });
      
      console.log('✅', deletedCount, 'order references permanently deleted');
    }

    // ============================================
    // STEP 3: Delete image from Cloudinary
    // ============================================
    const imageUrl = menuItem.image;
    
    if (imageUrl) {
      try {
        console.log('🗑️  Deleting image from Cloudinary...');
        await deleteImage(imageUrl);
        console.log('✅ Image deleted from Cloudinary');
      } catch (imageError) {
        console.warn('⚠️  Image deletion failed:', imageError.message);
        console.warn('   (Continuing with menu item deletion)');
      }
    }
    
    // ============================================
    // STEP 4: Delete menu item from database
    // ============================================
    const deletedItemName = menuItem.name;
    
    await menuItem.destroy({ 
      force: true, // Hard delete
      transaction: t 
    });
    
    console.log('✅ Menu item permanently deleted');
    
    await t.commit();
    console.log('✅ Transaction committed');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('menu-deleted', { id: req.params.id, name: deletedItemName });
    }
    
    res.json({ 
      success: true, 
      message: force === 'true' 
        ? `"${deletedItemName}" and ${orderItemCount} order reference(s) permanently deleted`
        : `"${deletedItemName}" deleted successfully`,
      hardDeleted: true,
      deletedOrderItems: orderItemCount
    });
    
  } catch (error) {
    await t.rollback();
    
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ DELETE ERROR');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('Error:', error.name);
    console.error('Message:', error.message);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete: ' + error.message,
      error: error.message
    });
  }
});

// ============================================
// UPDATE AVAILABILITY
// ============================================
router.patch('/:id/availability', async (req, res) => {
  try {
    const { isAvailable } = req.body;
    const menuItem = await MenuItem.findByPk(req.params.id);
    
    if (!menuItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Menu item not found' 
      });
    }

    await menuItem.update({ isAvailable });
    
    const io = req.app.get('io');
    if (io) {
      io.emit('menu-updated', menuItem);
    }
    
    res.json({ 
      success: true, 
      data: menuItem 
    });
  } catch (error) {
    console.error('Update availability error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ============================================
// DELETE IMAGE ENDPOINT
// ============================================
router.post('/delete-image', async (req, res) => {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ 
        success: false, 
        message: 'Image URL is required' 
      });
    }

    const result = await deleteImage(imageUrl);
    
    res.json(result);
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

module.exports = router;