const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Table = sequelize.define('Table', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  number: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true
  },
  capacity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 4
  },
  status: {
    type: DataTypes.ENUM('available', 'occupied', 'reserved', 'cleaning'),
    defaultValue: 'available'
  },
  floor: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  section: {
    type: DataTypes.STRING,
    allowNull: true
  },
  qrCode: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = Table;