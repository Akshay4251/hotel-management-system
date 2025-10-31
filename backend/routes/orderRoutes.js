const express = require('express');
const router = express.Router();
const { Order, OrderItem, Table, MenuItem, User } = require('../models');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

// ============================================
// GET ALL ORDERS
// ============================================
router.get('/', async (req, res) => {
  try {
    const { status, tableId, type, startDate, endDate } = req.query;
    const where = {};
    
    if (status) where.status = status;
    if (tableId) where.tableId = tableId;
    if (type) where.type = type;
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }
    
    const orders = await Order.findAll({
      where,
      include: [
        { 
          model: Table, 
          as: 'table',
          attributes: ['id', 'number', 'status', 'capacity']
        },
        { 
          model: OrderItem, 
          as: 'items',
          include: [
            { 
              model: MenuItem, 
              as: 'menuItem',
              attributes: ['id', 'name', 'price', 'category', 'isVeg', 'image']
            }
          ]
        },
        {
          model: User,
          as: 'waiter',
          attributes: ['id', 'name', 'email'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    res.json({ 
      success: true, 
      data: orders,
      count: orders.length 
    });
  } catch (error) {
    console.error('❌ Get orders error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch orders',
      error: error.message 
    });
  }
});

// ============================================
// GET SINGLE ORDER BY ID
// ============================================
router.get('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findByPk(orderId, {
      include: [
        { model: Table, as: 'table' },
        { 
          model: OrderItem, 
          as: 'items',
          include: [{ model: MenuItem, as: 'menuItem' }]
        },
        { model: User, as: 'waiter', attributes: ['id', 'name', 'email'] }
      ]
    });
    
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }
    
    res.json({ success: true, data: order });
  } catch (error) {
    console.error('❌ Get order error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ============================================
// GET ORDER BY TABLE NUMBER
// ============================================
router.get('/table/:tableNumber', async (req, res) => {
  try {
    const { tableNumber } = req.params;
    
    console.log('🔍 Looking for table:', tableNumber);
    
    const table = await Table.findOne({ 
      where: { number: parseInt(tableNumber) } 
    });
    
    if (!table) {
      return res.status(404).json({ 
        success: false, 
        message: `Table ${tableNumber} not found` 
      });
    }
    
    console.log('✅ Table found:', table.id);
    
    const order = await Order.findOne({
      where: { 
        tableId: table.id,
        status: { [Op.notIn]: ['completed', 'cancelled'] }
      },
      include: [
        { model: Table, as: 'table' },
        { 
          model: OrderItem, 
          as: 'items',
          include: [{ model: MenuItem, as: 'menuItem' }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    if (order) {
      console.log('✅ Active order found:', order.orderNumber);
    } else {
      console.log('ℹ️  No active order for this table');
    }
    
    res.json({ success: true, data: order });
  } catch (error) {
    console.error('❌ Get order by table error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ============================================
// GENERATE KOT (Kitchen Order Ticket)
// ============================================
router.get('/:orderId/kot', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findByPk(orderId, {
      include: [
        { model: Table, as: 'table' },
        { 
          model: OrderItem, 
          as: 'items',
          include: [{ model: MenuItem, as: 'menuItem' }]
        }
      ]
    });
    
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }
    
    const kot = {
      kotNumber: `KOT-${order.orderNumber}`,
      orderNumber: order.orderNumber,
      tableNumber: order.table?.number,
      orderTime: order.createdAt,
      items: order.items.map(item => ({
        id: item.id,
        name: item.menuItem?.name,
        quantity: item.quantity,
        notes: item.notes,
        isVeg: item.menuItem?.isVeg,
        status: item.status
      })),
      orderType: order.type,
      notes: order.notes,
      totalItems: order.items.reduce((sum, item) => sum + item.quantity, 0)
    };
    
    res.json({ success: true, data: kot });
  } catch (error) {
    console.error('❌ KOT generation error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ============================================
// CREATE NEW ORDER (ENHANCED WITH DETAILED LOGGING)
// ============================================
router.post('/', async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { tableNumber, items, type = 'dine-in', waiterId, notes } = req.body;
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📥 NEW ORDER REQUEST');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Table Number:', tableNumber);
    console.log('Items Count:', items?.length);
    console.log('Type:', type);
    console.log('Waiter ID:', waiterId);
    console.log('Notes:', notes);
    console.log('\n📦 RAW ITEMS RECEIVED:');
    console.log(JSON.stringify(items, null, 2));
    
    // ============================================
    // DETAILED ITEM INSPECTION
    // ============================================
    console.log('\n🔍 DETAILED ITEM INSPECTION:');
    items?.forEach((item, index) => {
      const menuItemId = item.menuItemId || item.id;
      console.log(`\n📦 Item ${index + 1}:`);
      console.log('  Raw Object:', JSON.stringify(item));
      console.log('  item.menuItemId:', item.menuItemId);
      console.log('  item.id:', item.id);
      console.log('  Extracted ID:', menuItemId);
      console.log('  Type:', typeof menuItemId);
      console.log('  Length:', menuItemId?.length);
      console.log('  Is String:', typeof menuItemId === 'string');
      console.log('  Is Valid UUID:', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(menuItemId));
      console.log('  Quantity:', item.quantity, '(type:', typeof item.quantity, ')');
    });
    
    // ============================================
    // VALIDATION
    // ============================================
    if (!tableNumber) {
      await t.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'Table number is required' 
      });
    }
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      await t.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'At least one item is required' 
      });
    }
    
    // ============================================
    // FIND TABLE
    // ============================================
    const table = await Table.findOne({ 
      where: { number: parseInt(tableNumber) } 
    });
    
    if (!table) {
      await t.rollback();
      return res.status(404).json({ 
        success: false, 
        message: `Table ${tableNumber} not found in database`,
        hint: 'Please create this table first in admin panel'
      });
    }
    
    console.log('\n✅ Table found:', {
      id: table.id,
      number: table.number,
      status: table.status
    });
    
    // ============================================
    // CHECK FOR EXISTING ACTIVE ORDER
    // ============================================
    const existingOrder = await Order.findOne({
      where: {
        tableId: table.id,
        status: { [Op.notIn]: ['completed', 'cancelled'] }
      }
    });
    
    if (existingOrder) {
      await t.rollback();
      console.log('⚠️  Table already has active order:', existingOrder.orderNumber);
      return res.status(400).json({
        success: false,
        message: `Table ${tableNumber} already has an active order`,
        orderId: existingOrder.id,
        orderNumber: existingOrder.orderNumber,
        hint: 'Use POST /api/orders/:orderId/items to add more items'
      });
    }
    
    // ============================================
    // EXTRACT AND VALIDATE MENU ITEM IDS
    // ============================================
    const menuItemIds = items.map(item => {
      const id = item.menuItemId || item.id;
      console.log(`  Extracting ID from item:`, id);
      return id;
    });
    
    const uniqueMenuItemIds = [...new Set(menuItemIds)];
    
    console.log('\n🔍 MENU ITEM IDS TO VALIDATE:');
    console.log('All IDs:', menuItemIds);
    console.log('Unique IDs:', uniqueMenuItemIds);
    console.log('Count:', uniqueMenuItemIds.length);
    
    // ============================================
    // CHECK EACH ID INDIVIDUALLY IN DATABASE
    // ============================================
    console.log('\n🔍 CHECKING EACH ID IN DATABASE:');
    for (const id of uniqueMenuItemIds) {
      console.log(`\nChecking ID: ${id}`);
      console.log(`  Type: ${typeof id}`);
      console.log(`  Length: ${id?.length}`);
      
      try {
        const menuItem = await MenuItem.findByPk(id);
        if (menuItem) {
          console.log(`  ✅ FOUND: ${menuItem.name}`);
          console.log(`     - ID in DB: ${menuItem.id}`);
          console.log(`     - Price: ₹${menuItem.price}`);
          console.log(`     - Available: ${menuItem.isAvailable}`);
        } else {
          console.log(`  ❌ NOT FOUND`);
        }
      } catch (error) {
        console.log(`  ❌ ERROR checking ID: ${error.message}`);
      }
    }
    
    // ============================================
    // FETCH ALL MATCHING MENU ITEMS
    // ============================================
    console.log('\n📋 FETCHING MENU ITEMS FROM DATABASE...');
    
    const foundMenuItems = await MenuItem.findAll({
      where: {
        id: { [Op.in]: uniqueMenuItemIds }
      },
      attributes: ['id', 'name', 'price', 'isAvailable', 'category', 'isVeg']
    });
    
    console.log(`\n📊 QUERY RESULT: Found ${foundMenuItems.length} of ${uniqueMenuItemIds.length} items`);
    
    foundMenuItems.forEach(item => {
      console.log(`  ✅ ${item.name}:`);
      console.log(`     ID: ${item.id}`);
      console.log(`     Price: ₹${item.price}`);
      console.log(`     Available: ${item.isAvailable}`);
    });
    
    // ============================================
    // CHECK IF ALL ITEMS WERE FOUND
    // ============================================
    if (foundMenuItems.length !== uniqueMenuItemIds.length) {
      const foundIds = foundMenuItems.map(item => item.id);
      const missingIds = uniqueMenuItemIds.filter(id => !foundIds.includes(id));
      
      await t.rollback();
      
      console.error('\n❌ MENU ITEMS NOT FOUND!');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('Sent IDs:', uniqueMenuItemIds);
      console.error('Found IDs:', foundIds);
      console.error('Missing IDs:', missingIds);
      
      // Get all available menu items for comparison
      const allMenuItems = await MenuItem.findAll({
        attributes: ['id', 'name', 'category']
      });
      
      console.error('\n📋 ALL AVAILABLE MENU ITEMS IN DATABASE:');
      allMenuItems.forEach((item, index) => {
        console.error(`  ${index + 1}. ${item.name} (${item.category})`);
        console.error(`     ID: ${item.id}`);
      });
      
      console.error('\n🔍 ID COMPARISON:');
      missingIds.forEach(missingId => {
        console.error(`\nMissing ID: ${missingId}`);
        console.error(`  Type: ${typeof missingId}`);
        console.error(`  Length: ${missingId?.length}`);
        
        // Check for similar IDs
        allMenuItems.forEach(dbItem => {
          if (dbItem.id.toLowerCase() === missingId.toLowerCase()) {
            console.error(`  ⚠️  Case mismatch with: ${dbItem.id}`);
          }
          if (dbItem.id.includes(missingId) || missingId.includes(dbItem.id)) {
            console.error(`  ⚠️  Partial match with: ${dbItem.id}`);
          }
        });
      });
      
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      return res.status(400).json({ 
        success: false, 
        message: 'Some menu items do not exist in database',
        missingIds,
        foundIds,
        sentIds: uniqueMenuItemIds,
        availableIds: allMenuItems.map(i => ({ 
          id: i.id, 
          name: i.name,
          category: i.category
        })),
        hint: 'Check backend console logs for detailed ID comparison'
      });
    }
    
    // ============================================
    // CHECK AVAILABILITY
    // ============================================
    const unavailableItems = foundMenuItems.filter(item => !item.isAvailable);
    if (unavailableItems.length > 0) {
      await t.rollback();
      console.warn('⚠️  Unavailable items:', unavailableItems.map(i => i.name));
      return res.status(400).json({
        success: false,
        message: 'Some items are not available',
        unavailableItems: unavailableItems.map(item => ({
          id: item.id,
          name: item.name
        }))
      });
    }
    
    console.log('\n✅ ALL VALIDATIONS PASSED!');
    
    // ============================================
    // CALCULATE TOTALS & PREPARE ORDER ITEMS
    // ============================================
    console.log('\n💰 CALCULATING TOTALS...');
    
    let subtotal = 0;
    const orderItemsData = [];
    
    for (const item of items) {
      const menuItemId = item.menuItemId || item.id;
      const menuItem = foundMenuItems.find(mi => mi.id === menuItemId);
      
      if (!menuItem) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: `Menu item ${menuItemId} not found`
        });
      }
      
      const quantity = parseInt(item.quantity) || 1;
      const price = parseFloat(menuItem.price);
      const itemTotal = price * quantity;
      
      subtotal += itemTotal;
      
      orderItemsData.push({
        menuItemId: menuItem.id,
        quantity: quantity,
        price: price,
        total: itemTotal,
        notes: item.notes || null,
        status: 'pending'
      });
      
      console.log(`  ✓ ${menuItem.name} x${quantity} = ₹${itemTotal.toFixed(2)}`);
    }
    
    const tax = subtotal * 0.18; // 18% GST
    const discount = 0;
    const total = subtotal + tax - discount;
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💰 ORDER TOTALS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Subtotal:', `₹${subtotal.toFixed(2)}`);
    console.log('Tax (18%):', `₹${tax.toFixed(2)}`);
    console.log('Discount:', `₹${discount.toFixed(2)}`);
    console.log('Total:', `₹${total.toFixed(2)}`);
    
    // ============================================
    // CREATE ORDER
    // ============================================
    console.log('\n📝 CREATING ORDER...');
    
    const order = await Order.create({
      tableId: table.id,
      waiterId: waiterId || null,
      type,
      subtotal,
      tax,
      discount,
      total,
      notes: notes || null,
      status: 'confirmed',
      isPaid: false
    }, { transaction: t });
    
    console.log('✅ Order created:', {
      id: order.id,
      orderNumber: order.orderNumber,
      tableId: order.tableId,
      status: order.status
    });
    
    // ============================================
    // CREATE ORDER ITEMS
    // ============================================
    console.log('\n📦 CREATING ORDER ITEMS...');
    
    const createdItems = [];
    for (const itemData of orderItemsData) {
      console.log(`  Creating: ${itemData.menuItemId} x${itemData.quantity}`);
      
      const orderItem = await OrderItem.create({
        orderId: order.id,
        ...itemData
      }, { transaction: t });
      
      createdItems.push(orderItem);
      console.log(`  ✅ Created order item: ${orderItem.id}`);
    }
    
    console.log(`\n✅ Created ${createdItems.length} order items`);
    
    // ============================================
    // UPDATE TABLE STATUS
    // ============================================
    await table.update({ 
      status: 'occupied' 
    }, { transaction: t });
    
    console.log('✅ Table status updated to: occupied');
    
    // ============================================
    // COMMIT TRANSACTION
    // ============================================
    await t.commit();
    console.log('✅ Transaction committed successfully');
    
    // ============================================
    // FETCH COMPLETE ORDER WITH ASSOCIATIONS
    // ============================================
    const completeOrder = await Order.findByPk(order.id, {
      include: [
        { model: Table, as: 'table' },
        { 
          model: OrderItem, 
          as: 'items',
          include: [{ model: MenuItem, as: 'menuItem' }]
        },
        { model: User, as: 'waiter', attributes: ['id', 'name', 'email'], required: false }
      ]
    });
    
    console.log('\n✅ Complete order fetched');
    
    // ============================================
    // EMIT SOCKET EVENTS
    // ============================================
    const io = req.app.get('io');
    if (io) {
      console.log('📡 Emitting socket events...');
      
      io.emit('new-order', completeOrder);
      io.emit('table-updated', table);
      
      io.to('kitchen').emit('print-kot', {
        id: completeOrder.id,
        orderNumber: completeOrder.orderNumber,
        tableNumber: completeOrder.table?.number,
        items: completeOrder.items.map(item => ({
          id: item.id,
          name: item.menuItem?.name,
          quantity: item.quantity,
          notes: item.notes,
          isVeg: item.menuItem?.isVeg
        })),
        type: completeOrder.type,
        notes: completeOrder.notes,
        createdAt: completeOrder.createdAt
      });
      
      console.log('✅ Socket events emitted');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ ORDER CREATION COMPLETED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // ============================================
    // RETURN SUCCESS RESPONSE
    // ============================================
    res.status(201).json({ 
      success: true, 
      data: completeOrder,
      message: `Order ${order.orderNumber} created successfully`
    });
    
  } catch (error) {
    await t.rollback();
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ ORDER CREATION ERROR');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    console.error('Stack Trace:');
    console.error(error.stack);
    
    // Handle specific Sequelize errors
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      console.error('\n🔴 FOREIGN KEY CONSTRAINT VIOLATION');
      console.error('Table:', error.table);
      console.error('Fields:', error.fields);
      console.error('Value:', error.value);
      console.error('Index:', error.index);
      
      return res.status(400).json({
        success: false,
        message: 'Foreign key constraint violation',
        details: 'One or more referenced items do not exist in database',
        error: error.message,
        hint: 'Check that all menu items and table exist',
        technicalDetails: {
          table: error.table,
          fields: error.fields,
          constraint: error.index
        }
      });
    }
    
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors.map(e => ({
          field: e.path,
          message: e.message,
          value: e.value
        }))
      });
    }
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: 'Duplicate entry',
        error: error.message
      });
    }
    
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create order',
      error: error.message 
    });
  }
});

// ============================================
// ADD ITEMS TO EXISTING ORDER
// ============================================
router.post('/:orderId/items', async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { orderId } = req.params;
    const { items } = req.body;
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📥 ADD ITEMS TO ORDER:', orderId);
    console.log('Items:', JSON.stringify(items, null, 2));
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Items array is required'
      });
    }
    
    const order = await Order.findByPk(orderId);
    if (!order) {
      await t.rollback();
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }
    
    if (order.status === 'completed' || order.status === 'cancelled') {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Cannot add items to completed or cancelled order'
      });
    }
    
    // Validate menu items
    const menuItemIds = items.map(item => item.menuItemId || item.id);
    const uniqueMenuItemIds = [...new Set(menuItemIds)];
    
    const foundMenuItems = await MenuItem.findAll({
      where: {
        id: { [Op.in]: uniqueMenuItemIds }
      }
    });
    
    if (foundMenuItems.length !== uniqueMenuItemIds.length) {
      const foundIds = foundMenuItems.map(item => item.id);
      const missingIds = uniqueMenuItemIds.filter(id => !foundIds.includes(id));
      
      await t.rollback();
      return res.status(400).json({ 
        success: false, 
        message: `Menu items not found: ${missingIds.join(', ')}`,
        missingIds
      });
    }
    
    let additionalSubtotal = 0;
    const newItems = [];
    
    for (const item of items) {
      const menuItemId = item.menuItemId || item.id;
      const menuItem = foundMenuItems.find(mi => mi.id === menuItemId);
      const quantity = parseInt(item.quantity) || 1;
      const price = parseFloat(menuItem.price);
      const itemTotal = price * quantity;
      
      additionalSubtotal += itemTotal;
      
      const orderItem = await OrderItem.create({
        orderId: order.id,
        menuItemId: menuItem.id,
        quantity: quantity,
        price: price,
        total: itemTotal,
        notes: item.notes || null,
        status: 'pending'
      }, { transaction: t });
      
      newItems.push(orderItem);
      console.log(`  ✓ Added: ${menuItem.name} x${quantity}`);
    }
    
    // Update order totals
    order.subtotal = parseFloat(order.subtotal) + additionalSubtotal;
    order.tax = order.subtotal * 0.18;
    order.total = order.subtotal + order.tax - parseFloat(order.discount || 0);
    await order.save({ transaction: t });
    
    console.log('💰 Updated totals:', {
      subtotal: order.subtotal,
      tax: order.tax,
      total: order.total
    });
    
    await t.commit();
    console.log('✅ Items added successfully');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Fetch updated order
    const updatedOrder = await Order.findByPk(orderId, {
      include: [
        { model: Table, as: 'table' },
        { model: OrderItem, as: 'items', include: [{ model: MenuItem, as: 'menuItem' }] }
      ]
    });
    
    // Emit socket events
    const io = req.app.get('io');
    if (io) {
      io.emit('order-updated', updatedOrder);
      
      // Emit KOT for new items only
      io.to('kitchen').emit('print-kot', {
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        tableNumber: updatedOrder.table?.number,
        items: newItems.map(item => {
          const menuItem = foundMenuItems.find(mi => mi.id === item.menuItemId);
          return {
            id: item.id,
            name: menuItem?.name,
            quantity: item.quantity,
            notes: item.notes,
            isVeg: menuItem?.isVeg
          };
        }),
        type: updatedOrder.type,
        notes: '⚡ ADDITIONAL ITEMS',
        createdAt: new Date()
      });
    }
    
    res.json({ 
      success: true, 
      data: updatedOrder,
      message: `${newItems.length} item(s) added to order`
    });
    
  } catch (error) {
    await t.rollback();
    console.error('❌ Add items error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add items',
      error: error.message 
    });
  }
});

// ============================================
// DELETE ITEM FROM ORDER
// ============================================
router.delete('/:orderId/items/:itemId', async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { orderId, itemId } = req.params;
    
    console.log('🗑️  DELETE ITEM:', { orderId, itemId });
    
    const order = await Order.findByPk(orderId);
    if (!order) {
      await t.rollback();
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }
    
    if (order.status === 'completed' || order.status === 'cancelled') {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Cannot delete items from completed or cancelled order'
      });
    }
    
    const orderItem = await OrderItem.findOne({
      where: { id: itemId, orderId },
      include: [{ model: MenuItem, as: 'menuItem' }]
    });
    
    if (!orderItem) {
      await t.rollback();
      return res.status(404).json({ 
        success: false, 
        message: 'Order item not found' 
      });
    }
    
    // Check if item is already served
    if (orderItem.status === 'served') {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Cannot delete items that have already been served',
        itemStatus: orderItem.status
      });
    }
    
    const itemTotal = parseFloat(orderItem.total);
    const itemName = orderItem.menuItem?.name;
    
    // Delete the item
    await orderItem.destroy({ transaction: t });
    console.log('✅ Item deleted:', itemName);
    
    // Check remaining items
    const remainingItems = await OrderItem.count({
      where: { orderId }
    });
    
    if (remainingItems === 0) {
      // No items left - cancel order and free table
      order.status = 'cancelled';
      await order.save({ transaction: t });
      
      const table = await Table.findByPk(order.tableId);
      if (table) {
        table.status = 'available';
        await table.save({ transaction: t });
        console.log('🪑 Table freed:', table.number);
      }
      
      await t.commit();
      console.log('⚠️  Order cancelled - no items left');
      
      const io = req.app.get('io');
      if (io) {
        io.emit('order-cancelled', order);
        if (table) io.emit('table-updated', table);
      }
      
      return res.json({ 
        success: true, 
        message: 'Last item deleted. Order cancelled and table freed.',
        orderCancelled: true
      });
    }
    
    // Recalculate totals
    order.subtotal = parseFloat(order.subtotal) - itemTotal;
    order.tax = order.subtotal * 0.18;
    order.total = order.subtotal + order.tax - parseFloat(order.discount || 0);
    await order.save({ transaction: t });
    
    console.log('💰 Recalculated totals:', {
      subtotal: order.subtotal,
      total: order.total
    });
    
    await t.commit();
    
    // Fetch updated order
    const updatedOrder = await Order.findByPk(orderId, {
      include: [
        { model: Table, as: 'table' },
        { model: OrderItem, as: 'items', include: [{ model: MenuItem, as: 'menuItem' }] }
      ]
    });
    
    const io = req.app.get('io');
    if (io) {
      io.emit('order-updated', updatedOrder);
    }
    
    res.json({ 
      success: true, 
      data: updatedOrder,
      message: `${itemName} removed from order`
    });
    
  } catch (error) {
    await t.rollback();
    console.error('❌ Delete item error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete item',
      error: error.message 
    });
  }
});

// ============================================
// UPDATE ORDER ITEM STATUS
// ============================================
router.put('/:orderId/items/:itemId/status', async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { status, preparedBy, servedBy } = req.body;
    
    console.log('🔄 UPDATE ITEM STATUS:', { orderId, itemId, status });
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }
    
    const validStatuses = ['pending', 'preparing', 'ready', 'served', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }
    
    const orderItem = await OrderItem.findOne({
      where: { id: itemId, orderId },
      include: [{ model: MenuItem, as: 'menuItem' }]
    });
    
    if (!orderItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order item not found' 
      });
    }
    
    // Update status
    orderItem.status = status;
    
    // Update timestamps based on status
    if (status === 'preparing' && preparedBy) {
      orderItem.preparedBy = preparedBy;
    }
    
    if (status === 'ready') {
      orderItem.preparedAt = new Date();
    }
    
    if (status === 'served') {
      orderItem.servedAt = new Date();
      if (servedBy) {
        orderItem.servedBy = servedBy;
      }
    }
    
    await orderItem.save();
    
    console.log(`✅ Item status updated: ${orderItem.menuItem?.name} -> ${status}`);
    
    // Check if all items in order are served
    const allItems = await OrderItem.findAll({
      where: { orderId }
    });
    
    const allServed = allItems.every(item => item.status === 'served');
    const allReady = allItems.every(item => ['ready', 'served'].includes(item.status));
    
    // Update order status accordingly
    const order = await Order.findByPk(orderId);
    if (order) {
      if (allServed) {
        order.status = 'served';
        await order.save();
        console.log('✅ All items served - Order status: served');
      } else if (allReady) {
        order.status = 'ready';
        await order.save();
        console.log('✅ All items ready - Order status: ready');
      } else if (allItems.some(item => item.status === 'preparing')) {
        order.status = 'preparing';
        await order.save();
      }
    }
    
    // Fetch updated order
    const updatedOrder = await Order.findByPk(orderId, {
      include: [
        { model: Table, as: 'table' },
        { model: OrderItem, as: 'items', include: [{ model: MenuItem, as: 'menuItem' }] }
      ]
    });
    
    // Emit socket events
    const io = req.app.get('io');
    if (io) {
      io.emit('order-item-updated', {
        orderId,
        itemId,
        status,
        orderItem
      });
      io.emit('order-updated', updatedOrder);
      
      // Notify table if item is ready/served
      if (status === 'ready' || status === 'served') {
        io.to(`table-${updatedOrder.table?.number}`).emit('item-status-changed', {
          itemName: orderItem.menuItem?.name,
          status
        });
      }
    }
    
    res.json({ 
      success: true, 
      data: orderItem,
      order: updatedOrder,
      message: `Item status updated to ${status}`
    });
    
  } catch (error) {
    console.error('❌ Update item status error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update item status',
      error: error.message 
    });
  }
});

// ============================================
// UPDATE ORDER STATUS
// ============================================
router.put('/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    
    console.log('🔄 UPDATE ORDER STATUS:', { orderId, status });
    
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }
    
    const order = await Order.findByPk(orderId, {
      include: [
        { model: Table, as: 'table' },
        { model: OrderItem, as: 'items' }
      ]
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    const oldStatus = order.status;
    order.status = status;
    
    // If order is completed/cancelled, free the table
    if (status === 'completed' || status === 'cancelled') {
      const table = await Table.findByPk(order.tableId);
      if (table && table.status === 'occupied') {
        table.status = 'available';
        await table.save();
        console.log('🪑 Table freed:', table.number);
        
        const io = req.app.get('io');
        if (io) {
          io.emit('table-updated', table);
        }
      }
    }
    
    await order.save();
    console.log(`✅ Order status: ${oldStatus} -> ${status}`);
    
    // Fetch complete order
    const updatedOrder = await Order.findByPk(orderId, {
      include: [
        { model: Table, as: 'table' },
        { model: OrderItem, as: 'items', include: [{ model: MenuItem, as: 'menuItem' }] }
      ]
    });
    
    // Emit socket events
    const io = req.app.get('io');
    if (io) {
      io.emit('order-updated', updatedOrder);
      
      if (status === 'cancelled') {
        io.emit('order-cancelled', updatedOrder);
      }
    }
    
    res.json({
      success: true,
      data: updatedOrder,
      message: `Order status updated to ${status}`
    });
    
  } catch (error) {
    console.error('❌ Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: error.message
    });
  }
});

// ============================================
// CANCEL ORDER
// ============================================
router.delete('/:orderId', async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { orderId } = req.params;
    
    console.log('🗑️  CANCEL ORDER:', orderId);
    
    const order = await Order.findByPk(orderId, {
      include: [{ model: Table, as: 'table' }]
    });
    
    if (!order) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    if (order.status === 'completed') {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel completed order'
      });
    }
    
    // Update order status to cancelled
    order.status = 'cancelled';
    await order.save({ transaction: t });
    
    // Free the table
    const table = await Table.findByPk(order.tableId);
    if (table) {
      table.status = 'available';
      await table.save({ transaction: t });
    }
    
    await t.commit();
    console.log('✅ Order cancelled:', order.orderNumber);
    
    // Emit socket events
    const io = req.app.get('io');
    if (io) {
      io.emit('order-cancelled', order);
      if (table) io.emit('table-updated', table);
    }
    
    res.json({
      success: true,
      message: 'Order cancelled successfully',
      data: order
    });
    
  } catch (error) {
    await t.rollback();
    console.error('❌ Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel order',
      error: error.message
    });
  }
});

module.exports = router;