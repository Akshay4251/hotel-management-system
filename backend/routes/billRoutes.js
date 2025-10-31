const express = require('express');
const router = express.Router();
const { Bill, Order, OrderItem, Table, MenuItem } = require('../models');
const { sequelize } = require('../config/database');

// ============================================
// GENERATE BILL FOR ORDER
// ============================================
router.post('/generate/:orderId', async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { orderId } = req.params;
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💰 GENERATE BILL REQUEST');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Order ID:', orderId);
    
    // Find order with all details
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
    
    console.log('✅ Order found:', order.orderNumber);
    console.log('   Table:', order.table?.number);
    console.log('   Items:', order.items?.length);
    console.log('   Total:', order.total);
    
    // Check if bill already exists
    let existingBill = await Bill.findOne({
      where: { orderId: order.id }
    });
    
    if (existingBill) {
      console.log('ℹ️  Bill already exists:', existingBill.billNumber);
      
      // Return existing bill
      const billWithDetails = await Bill.findByPk(existingBill.id, {
        include: [
          {
            model: Order,
            as: 'order',
            include: [
              { model: Table, as: 'table' },
              {
                model: OrderItem,
                as: 'items',
                include: [{ model: MenuItem, as: 'menuItem' }]
              }
            ]
          }
        ]
      });
      
      return res.json({
        success: true,
        data: billWithDetails,
        message: 'Bill already generated'
      });
    }
    
    // Generate bill number
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const billNumber = `BILL${year}${month}${day}${random}`;
    
    console.log('📄 Generating bill:', billNumber);
    
    // Create bill
    const bill = await Bill.create({
      billNumber,
      orderId: order.id,
      tableId: order.tableId, // ✅ CRITICAL: Include tableId
      subtotal: order.subtotal,
      tax: order.tax,
      discount: order.discount || 0,
      totalAmount: order.total,
      isPaid: false
    }, { transaction: t });
    
    console.log('✅ Bill created:', bill.id);
    
    await t.commit();
    console.log('✅ Transaction committed');
    
    // Fetch complete bill
    const completeBill = await Bill.findByPk(bill.id, {
      include: [
        {
          model: Order,
          as: 'order',
          include: [
            { model: Table, as: 'table' },
            {
              model: OrderItem,
              as: 'items',
              include: [{ model: MenuItem, as: 'menuItem' }]
            }
          ]
        },
        { model: Table, as: 'table' }
      ]
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ BILL GENERATED SUCCESSFULLY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('bill-generated', completeBill);
    }
    
    res.status(201).json({
      success: true,
      data: completeBill,
      message: 'Bill generated successfully'
    });
    
  } catch (error) {
    await t.rollback();
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ BILL GENERATION ERROR');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    res.status(500).json({
      success: false,
      message: 'Failed to generate bill',
      error: error.message
    });
  }
});

// ============================================
// GET BILL BY ID
// ============================================
router.get('/:billId', async (req, res) => {
  try {
    const { billId } = req.params;
    
    const bill = await Bill.findByPk(billId, {
      include: [
        {
          model: Order,
          as: 'order',
          include: [
            { model: Table, as: 'table' },
            {
              model: OrderItem,
              as: 'items',
              include: [{ model: MenuItem, as: 'menuItem' }]
            }
          ]
        },
        { model: Table, as: 'table' }
      ]
    });
    
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }
    
    res.json({
      success: true,
      data: bill
    });
  } catch (error) {
    console.error('❌ Get bill error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bill',
      error: error.message
    });
  }
});

// ============================================
// GET ALL BILLS
// ============================================
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, isPaid } = req.query;
    const where = {};
    
    if (isPaid !== undefined) {
      where.isPaid = isPaid === 'true';
    }
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }
    
    const bills = await Bill.findAll({
      where,
      include: [
        {
          model: Order,
          as: 'order',
          include: [
            { model: Table, as: 'table' },
            {
              model: OrderItem,
              as: 'items',
              include: [{ model: MenuItem, as: 'menuItem' }]
            }
          ]
        },
        { model: Table, as: 'table' }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    res.json({
      success: true,
      data: bills,
      count: bills.length
    });
  } catch (error) {
    console.error('❌ Get bills error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bills',
      error: error.message
    });
  }
});

// ============================================
// SETTLE BILL (MARK AS PAID)
// ============================================
router.post('/:billId/settle', async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { billId } = req.params;
    const { paymentMethod, paidAmount } = req.body;
    
    console.log('💳 SETTLE BILL:', billId);
    console.log('   Payment Method:', paymentMethod);
    console.log('   Amount:', paidAmount);
    
    if (!paymentMethod) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Payment method is required'
      });
    }
    
    const validMethods = ['cash', 'card', 'upi', 'wallet'];
    if (!validMethods.includes(paymentMethod)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Invalid payment method. Must be one of: ${validMethods.join(', ')}`
      });
    }
    
    const bill = await Bill.findByPk(billId, {
      include: [
        {
          model: Order,
          as: 'order',
          include: [{ model: Table, as: 'table' }]
        }
      ]
    });
    
    if (!bill) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }
    
    if (bill.isPaid) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Bill is already paid'
      });
    }
    
    // Update bill
    bill.isPaid = true;
    bill.paymentMethod = paymentMethod;
    bill.paidAmount = paidAmount || bill.totalAmount;
    bill.paidAt = new Date();
    await bill.save({ transaction: t });
    
    // Update order status to completed
    const order = await Order.findByPk(bill.orderId);
    if (order) {
      order.status = 'completed';
      order.isPaid = true;
      order.paymentMethod = paymentMethod;
      order.paidAt = new Date();
      await order.save({ transaction: t });
      
      // Free the table
      if (order.tableId) {
        const table = await Table.findByPk(order.tableId);
        if (table && table.status === 'occupied') {
          table.status = 'available';
          await table.save({ transaction: t });
          console.log('✅ Table freed:', table.number);
        }
      }
    }
    
    await t.commit();
    console.log('✅ Bill settled successfully');
    
    // Fetch updated bill
    const updatedBill = await Bill.findByPk(billId, {
      include: [
        {
          model: Order,
          as: 'order',
          include: [
            { model: Table, as: 'table' },
            {
              model: OrderItem,
              as: 'items',
              include: [{ model: MenuItem, as: 'menuItem' }]
            }
          ]
        },
        { model: Table, as: 'table' }
      ]
    });
    
    // Emit socket events
    const io = req.app.get('io');
    if (io) {
      io.emit('bill-updated', updatedBill);
      io.emit('order-updated', order);
      if (order?.tableId) {
        const table = await Table.findByPk(order.tableId);
        if (table) io.emit('table-updated', table);
      }
    }
    
    res.json({
      success: true,
      data: updatedBill,
      message: `Payment of ₹${paidAmount || bill.totalAmount} received via ${paymentMethod}`
    });
    
  } catch (error) {
    await t.rollback();
    console.error('❌ Settle bill error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to settle bill',
      error: error.message
    });
  }
});

// ============================================
// GET BILL BY ORDER ID
// ============================================
router.get('/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const bill = await Bill.findOne({
      where: { orderId },
      include: [
        {
          model: Order,
          as: 'order',
          include: [
            { model: Table, as: 'table' },
            {
              model: OrderItem,
              as: 'items',
              include: [{ model: MenuItem, as: 'menuItem' }]
            }
          ]
        },
        { model: Table, as: 'table' }
      ]
    });
    
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found for this order'
      });
    }
    
    res.json({
      success: true,
      data: bill
    });
  } catch (error) {
    console.error('❌ Get bill by order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bill',
      error: error.message
    });
  }
});

module.exports = router;