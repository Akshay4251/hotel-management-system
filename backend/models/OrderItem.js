const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const OrderItem = sequelize.define('OrderItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  orderId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Orders',  // ✅ PascalCase
      key: 'id'
    }
  },
  menuItemId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'MenuItems',  // ✅ CRITICAL: Must match MenuItem tableName
      key: 'id'
    }
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'preparing', 'ready', 'served', 'cancelled'),
    defaultValue: 'pending'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  preparedBy: {
    type: DataTypes.UUID,
    allowNull: true
  },
  servedBy: {
    type: DataTypes.UUID,
    allowNull: true
  },
  preparedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  servedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'OrderItems',  // ✅ PascalCase
  timestamps: true
});

module.exports = OrderItem;