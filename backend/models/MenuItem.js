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
  image: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'image'  // Maps to 'image' column in database
  },
  isVeg: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_veg'
  },
  isAvailable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_available'
  },
  preparationTime: {
    type: DataTypes.INTEGER,
    defaultValue: 15,
    field: 'preparation_time'
  },
  spiceLevel: {
    type: DataTypes.ENUM('mild', 'medium', 'hot'),
    allowNull: true,
    field: 'spice_level'
  },
  allergens: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
    field: 'allergens'
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
    field: 'tags'
  }
}, {
  tableName: 'menu_items',
  timestamps: true,
  underscored: true
});

module.exports = MenuItem;