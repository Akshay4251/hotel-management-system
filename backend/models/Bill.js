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
    unique: true
  },
  orderId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  customerId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  subtotal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  taxAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  discountAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'cancelled'),
    defaultValue: 'pending'
  },
  paymentMethod: {
    type: DataTypes.ENUM('cash', 'card', 'upi', 'wallet'),
    allowNull: true
  },
  paidAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  changeAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  cashierId: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  timestamps: true,
  hooks: {
    beforeCreate: async (bill) => {
      // Generate bill number
      const date = new Date();
      const year = date.getFullYear().toString().substr(-2);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      bill.billNumber = `BILL${year}${month}${day}${random}`;
    }
  }
});

module.exports = Bill;