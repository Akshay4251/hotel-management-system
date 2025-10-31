const User = require('./User');
const Table = require('./Table');
const MenuItem = require('./MenuItem');
const Order = require('./Order');
const OrderItem = require('./OrderItem');
const Bill = require('./Bill');

// ============================================
// ASSOCIATIONS - Define all relationships
// ============================================

// Order <-> Table
Order.belongsTo(Table, { 
  foreignKey: 'tableId', 
  as: 'table',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE'
});

Table.hasMany(Order, { 
  foreignKey: 'tableId', 
  as: 'orders',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE'
});

// Order <-> User (Waiter)
Order.belongsTo(User, { 
  foreignKey: 'waiterId', 
  as: 'waiter',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});

User.hasMany(Order, { 
  foreignKey: 'waiterId', 
  as: 'orders',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});

// Order <-> OrderItem
Order.hasMany(OrderItem, { 
  foreignKey: 'orderId', 
  as: 'items',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

OrderItem.belongsTo(Order, { 
  foreignKey: 'orderId',
  as: 'order',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

// ✅ CRITICAL: OrderItem <-> MenuItem (Fixed foreign key)
OrderItem.belongsTo(MenuItem, { 
  foreignKey: 'menuItemId', 
  as: 'menuItem',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE',
  constraints: true // Enforce foreign key constraint
});

MenuItem.hasMany(OrderItem, { 
  foreignKey: 'menuItemId',
  as: 'orderItems',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE'
});

// Order <-> Bill
Order.hasOne(Bill, { 
  foreignKey: 'orderId', 
  as: 'bill',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

Bill.belongsTo(Order, { 
  foreignKey: 'orderId',
  as: 'order',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

// Bill <-> Table (if needed)
Bill.belongsTo(Table, {
  foreignKey: 'tableId',
  as: 'table',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE'
});

Table.hasMany(Bill, {
  foreignKey: 'tableId',
  as: 'bills',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE'
});

// Export all models
module.exports = {
  User,
  Table,
  MenuItem,
  Order,
  OrderItem,
  Bill
};