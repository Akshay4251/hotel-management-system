const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Bill = sequelize.define('Bill', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  billNumber: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  orderId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Orders',
      key: 'id'
    }
  },
  tableId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Tables',
      key: 'id'
    }
  },
  subtotal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'subtotal' // ✅ Explicitly map field name
  },
  tax: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'taxAmount' // ✅ CRITICAL: Map to actual DB column name
  },
  discount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    field: 'discount'
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'totalAmount'
  },
  isPaid: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'isPaid'
  },
  paymentMethod: {
    type: DataTypes.ENUM('cash', 'card', 'upi', 'wallet'),
    allowNull: true,
    field: 'paymentMethod'
  },
  paidAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'paidAmount'
  },
  paidAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'paidAt'
  }
}, {
  tableName: 'Bills',
  timestamps: true
});

module.exports = Bill;