// backend/models/MenuItem.js
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
  // ✅ Store as base64 text
  image: {
    type: DataTypes.TEXT, // Changed from STRING
    allowNull: true
  },
  // ✅ OR store as binary (BYTEA in PostgreSQL)
  imageData: {
    type: DataTypes.BLOB('long'), // Binary data
    allowNull: true
  },
  imageMimeType: {
    type: DataTypes.STRING, // e.g., 'image/jpeg'
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
  }
}, {
  tableName: 'MenuItems',
  timestamps: true
});

module.exports = MenuItem;