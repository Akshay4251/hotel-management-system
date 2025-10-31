const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MenuItem = sequelize.define('MenuItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  // ✅ ONLY use image field for base64 storage
  image: {
    type: DataTypes.TEXT, // Stores base64 data URI or URL
    allowNull: true
  },
  isVeg: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  isAvailable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  preparationTime: {
    type: DataTypes.INTEGER,
    defaultValue: 15
  },
  spiceLevel: {
    type: DataTypes.ENUM('mild', 'medium', 'hot'),
    allowNull: true
  },
  allergens: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  }
}, {
  tableName: 'MenuItems',
  timestamps: true
});

module.exports = MenuItem;