const express = require('express');
const router = express.Router();
const { Order, OrderItem, Table, MenuItem } = require('../models');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

// Get all orders
router.get('/', async (req, res) => {
  try {
    const { status, tableId } = req.query;
    const where = {};
    
    if (status) where.status = status;
    if (tableId) where.tableId = tableId;
    
    const orders = await Order.findAll({
      where,
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
    
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get order by table number
router.get('/table/:tableNumber', async (req, res) => {
  try {
    const { tableNumber } = req.params;
    
    const table = await Table.findOne({ where: { number: tableNumber } });
    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }
    
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
      ]
    });
    
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Generate KOT for printing
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
      tableNumber: order.table?.number,
      orderTime: order.createdAt,
      items: order.items.map(item => ({
        name: item.menuItem?.name,
        quantity: item.quantity,
        notes: item.notes,
        isVeg: item.menuItem?.isVeg
      })),
      orderType: order.type,
      notes: order.notes
    };
    
    res.json({ success: true, data: kot });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create new order
router.post('/', async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { tableNumber, items, type = 'dine-in', waiterId, notes } = req.body;
    
    // Find table
    const table = await Table.findOne({ 
      where: { number: tableNumber } 
    });
    
    if (!table) {
      await t.rollback();
      return res.status(404).json({ 
        success: false, 
        message: 'Table not found' 
      });
    }
    
    // Check if there's already an active order for this table
    const existingOrder = await Order.findOne({
      where: {
        tableId: table.id,
        status: { [Op.notIn]: ['completed', 'cancelled'] }
      }
    });
    
    if (existingOrder) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Table already has an active order. Use add items endpoint instead.',
        orderId: existingOrder.id
      });
    }
    
    // Calculate totals
    let subtotal = 0;
    const orderItems = [];
    
    for (const item of items) {
      const menuItem = await MenuItem.findByPk(item.menuItemId);
      if (!menuItem) {
        await t.rollback();
        return res.status(404).json({ 
          success: false, 
          message: `Menu item not found: ${item.menuItemId}` 
        });
      }
      
      const itemTotal = menuItem.price * item.quantity;
      subtotal += itemTotal;
      
      orderItems.push({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: menuItem.price,
        total: itemTotal,
        notes: item.notes
      });
    }
    
    const tax = subtotal * 0.18; // 18% GST
    const total = subtotal + tax;
    
    // Create order
    const order = await Order.create({
      tableId: table.id,
      waiterId,
      type,
      subtotal,
      tax,
      total,
      notes,
      status: 'confirmed'
    }, { transaction: t });
    
    // Create order items
    for (const item of orderItems) {
      await OrderItem.create({
        orderId: order.id,
        ...item
      }, { transaction: t });
    }
    
    // Update table status to occupied
    table.status = 'occupied';
    await table.save({ transaction: t });
    
    await t.commit();
    
    // Fetch complete order with associations
    const completeOrder = await Order.findByPk(order.id, {
      include: [
        { model: Table, as: 'table' },
        { 
          model: OrderItem, 
          as: 'items',
          include: [{ model: MenuItem, as: 'menuItem' }]
        }
      ]
    });
    
    // Emit socket events
    const io = req.app.get('io');
    io.emit('new-order', completeOrder);
    io.emit('table-updated', table);
    io.emit('orders-update', await Order.findAll({
      include: [
        { model: Table, as: 'table' },
        { model: OrderItem, as: 'items', include: [{ model: MenuItem, as: 'menuItem' }] }
      ]
    }));
    
    // Emit KOT print event to kitchen
    io.to('kitchen').emit('print-kot', {
      id: completeOrder.id,
      orderNumber: completeOrder.orderNumber,
      tableNumber: completeOrder.table?.number,
      items: completeOrder.items,
      type: completeOrder.type,
      notes: completeOrder.notes,
      createdAt: completeOrder.createdAt
    });
    
    res.status(201).json({ success: true, data: completeOrder });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add items to existing order
router.post('/:orderId/items', async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { orderId } = req.params;
    const { items } = req.body;
    
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
    
    let additionalSubtotal = 0;
    const newItems = [];
    
    for (const item of items) {
      const menuItem = await MenuItem.findByPk(item.menuItemId);
      if (!menuItem) {
        await t.rollback();
        return res.status(404).json({ 
          success: false, 
          message: `Menu item not found: ${item.menuItemId}` 
        });
      }
      
      const itemTotal = menuItem.price * item.quantity;
      additionalSubtotal += itemTotal;
      
      const orderItem = await OrderItem.create({
        orderId: order.id,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: menuItem.price,
        total: itemTotal,
        notes: item.notes
      }, { transaction: t });
      
      newItems.push(orderItem);
    }
    
    // Update order totals
    order.subtotal = parseFloat(order.subtotal) + additionalSubtotal;
    order.tax = order.subtotal * 0.18;
    order.total = order.subtotal + order.tax;
    await order.save({ transaction: t });
    
    await t.commit();
    
    // Fetch updated order
    const updatedOrder = await Order.findByPk(orderId, {
      include: [
        { model: Table, as: 'table' },
        { model: OrderItem, as: 'items', include: [{ model: MenuItem, as: 'menuItem' }] }
      ]
    });
    
    const io = req.app.get('io');
    io.emit('order-updated', updatedOrder);
    io.emit('orders-update', await Order.findAll({
      include: [
        { model: Table, as: 'table' },
        { model: OrderItem, as: 'items', include: [{ model: MenuItem, as: 'menuItem' }] }
      ]
    }));
    
    // Emit KOT print event for new items
    io.to('kitchen').emit('print-kot', {
      id: updatedOrder.id,
      orderNumber: updatedOrder.orderNumber,
      tableNumber: updatedOrder.table?.number,
      items: newItems.map(item => ({
        ...item.toJSON(),
        menuItem: items.find(i => i.menuItemId === item.menuItemId)
      })),
      type: updatedOrder.type,
      notes: 'ADDITIONAL ITEMS',
      createdAt: new Date()
    });
    
    res.json({ success: true, data: updatedOrder });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete item from order
router.delete('/:orderId/items/:itemId', async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { orderId, itemId } = req.params;
    
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
      where: { id: itemId, orderId }
    });
    
    if (!orderItem) {
      await t.rollback();
      return res.status(404).json({ 
        success: false, 
        message: 'Order item not found' 
      });
    }
    
    const itemTotal = parseFloat(orderItem.total);
    
    // Delete the item
    await orderItem.destroy({ transaction: t });
    
    // Check if there are any items left
    const remainingItems = await OrderItem.count({
      where: { orderId }
    });
    
    if (remainingItems === 0) {
      // If no items left, cancel the order and free the table
      order.status = 'cancelled';
      await order.save({ transaction: t });
      
      const table = await Table.findByPk(order.tableId);
      table.status = 'available';
      await table.save({ transaction: t });
      
      await t.commit();
      
      const io = req.app.get('io');
      io.emit('order-cancelled', order);
      io.emit('table-updated', table);
      
      return res.json({ 
        success: true, 
        message: 'Last item deleted. Order cancelled and table freed.',
        orderCancelled: true
      });
    }
    
    // Recalculate order totals
    order.subtotal = parseFloat(order.subtotal) - itemTotal;
    order.tax = order.subtotal * 0.18;
    order.total = order.subtotal + order.tax;
    await order.save({ transaction: t });
    
    await t.commit();
    
    // Fetch updated order
    const updatedOrder = await Order.findByPk(orderId, {
      include: [
        { model: Table, as: 'table' },
        { model: OrderItem, as: 'items', include: [{ model: MenuItem, as: 'menuItem' }] }
      ]
    });
    
    const io = req.app.get('io');
    io.emit('order-updated', updatedOrder);
    io.emit('orders-update', await Order.findAll({
      include: [
        { model: Table, as: 'table' },
        { model: OrderItem, as: 'items', include: [{ model: MenuItem, as: 'menuItem' }] }
      ]
    }));
    
    res.json({ success: true, data: updatedOrder });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update order item status
router.put('/:orderId/items/:itemId/status', async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { status } = req.body;
    
    const orderItem = await OrderItem.findOne({
      where: { id: itemId, orderId }
    });
    
    if (!orderItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order item not found' 
      });
    }
    
    orderItem.status = status;
    
    if (status === 'ready') {
      orderItem.preparedAt = new Date();
    } else if (status === 'served') {
      orderItem.servedAt = new Date();
    }
    
    await orderItem.save();
    
    // Check if all items are served
    const allItems = await OrderItem.findAll({
      where: { orderId }
    });
    
    const allServed = allItems.every(item => item.status === 'served');
    if (allServed) {
      await Order.update(
        { status: 'served' },
        { where: { id: orderId } }
      );
    }
    
    // Fetch updated order
    const updatedOrder = await Order.findByPk(orderId, {
      include: [
        { model: Table, as: 'table' },
        { model: OrderItem, as: 'items', include: [{ model: MenuItem, as: 'menuItem' }] }
      ]
    });
    
    const io = req.app.get('io');
    io.emit('order-item-updated', orderItem);
    io.emit('order-updated', updatedOrder);
    
    res.json({ success: true, data: orderItem });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;