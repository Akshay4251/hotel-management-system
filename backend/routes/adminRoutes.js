const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Order, Table } = require('../models');

router.get('/dashboard', async (req, res) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const todayRevenue = (await Order.sum('total', {
      where: { status: 'completed', createdAt: { [Op.gte]: start } }
    })) || 0;

    const activeOrders = await Order.count({
      where: { status: { [Op.notIn]: ['completed', 'cancelled'] } }
    });

    const occupiedTables = await Table.count({ where: { status: 'occupied' } });
    const totalTables = await Table.count();

    const todayOrders = await Order.count({
      where: { createdAt: { [Op.gte]: start } }
    });

    res.json({
      success: true,
      data: {
        todayRevenue,
        activeOrders,
        occupiedTables,
        totalTables,
        todayOrders
      }
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;