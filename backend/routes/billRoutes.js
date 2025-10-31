const express = require('express');
const router = express.Router();
const { Bill, Order, OrderItem, Table, MenuItem } = require('../models');
const { sequelize } = require('../config/database');

// Generate bill for order
router.post('/generate/:orderId', async (req, res) => {
  const t = await sequelize.transaction();
  
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
      await t.rollback();
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }
    
    // Check if bill already exists
    let bill = await Bill.findOne({ where: { orderId } });
    
    if (bill) {
      // Update existing bill with latest order totals
      bill.subtotal = order.subtotal;
      bill.taxAmount = order.tax;
      bill.totalAmount = order.total;
      await bill.save({ transaction: t });
    } else {
      // Create new bill
      bill = await Bill.create({
        orderId: order.id,
        customerId: order.customerId,
        subtotal: order.subtotal,
        taxAmount: order.tax,
        discountAmount: order.discount || 0,
        totalAmount: order.total
      }, { transaction: t });
    }
    
    await t.commit();
    
    // Fetch bill with order details
    const completeBill = await Bill.findByPk(bill.id, {
      include: [{
        model: Order,
        include: [
          { model: Table, as: 'table' },
          { model: OrderItem, as: 'items', include: [{ model: MenuItem, as: 'menuItem' }] }
        ]
      }]
    });
    
    res.json({ success: true, data: completeBill });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ success: false, message: error.message });
  }
});

// Settle bill (Payment)
router.post('/:billId/settle', async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { billId } = req.params;
    const { paymentMethod, paidAmount, cashierId } = req.body;
    
    const bill = await Bill.findByPk(billId);
    
    if (!bill) {
      await t.rollback();
      return res.status(404).json({ 
        success: false, 
        message: 'Bill not found' 
      });
    }
    
    if (bill.status === 'paid') {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Bill already settled'
      });
    }
    
    const totalAmount = parseFloat(bill.totalAmount);
    const paid = parseFloat(paidAmount);
    
    // Update bill
    bill.status = 'paid';
    bill.paymentMethod = paymentMethod;
    bill.paidAmount = paid;
    bill.changeAmount = paid - totalAmount;
    bill.cashierId = cashierId;
    await bill.save({ transaction: t });
    
    // Update order
    const order = await Order.findByPk(bill.orderId);
    order.status = 'completed';
    order.isPaid = true;
    order.paymentMethod = paymentMethod;
    order.paidAt = new Date();
    await order.save({ transaction: t });
    
    // Update table status to available
    const table = await Table.findByPk(order.tableId);
    table.status = 'available';
    await table.save({ transaction: t });
    
    await t.commit();
    
    // Fetch complete data
    const completeBill = await Bill.findByPk(bill.id, {
      include: [{
        model: Order,
        include: [
          { model: Table, as: 'table' },
          { model: OrderItem, as: 'items', include: [{ model: MenuItem, as: 'menuItem' }] }
        ]
      }]
    });
    
    const io = req.app.get('io');
    io.emit('bill-settled', completeBill);
    io.emit('table-updated', table);
    io.emit('orders-update', await Order.findAll({
      include: [
        { model: Table, as: 'table' },
        { model: OrderItem, as: 'items', include: [{ model: MenuItem, as: 'menuItem' }] }
      ]
    }));
    
    res.json({ success: true, data: completeBill });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get bill by ID
router.get('/:billId', async (req, res) => {
  try {
    const { billId } = req.params;
    
    const bill = await Bill.findByPk(billId, {
      include: [{
        model: Order,
        include: [
          { model: Table, as: 'table' },
          { model: OrderItem, as: 'items', include: [{ model: MenuItem, as: 'menuItem' }] }
        ]
      }]
    });
    
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }
    
    res.json({ success: true, data: bill });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;