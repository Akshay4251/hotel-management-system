const User = require('./User');
const Table = require('./Table');
const MenuItem = require('./MenuItem');
const Order = require('./Order');
const OrderItem = require('./OrderItem');
const Bill = require('./Bill');

// Define associations
Order.belongsTo(Table, { foreignKey: 'tableId', as: 'table' });
Table.hasMany(Order, { foreignKey: 'tableId', as: 'orders' });

Order.belongsTo(User, { foreignKey: 'waiterId', as: 'waiter' });
User.hasMany(Order, { foreignKey: 'waiterId', as: 'orders' });

Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });

OrderItem.belongsTo(MenuItem, { foreignKey: 'menuItemId', as: 'menuItem' });
MenuItem.hasMany(OrderItem, { foreignKey: 'menuItemId' });

Order.hasOne(Bill, { foreignKey: 'orderId', as: 'bill' });
Bill.belongsTo(Order, { foreignKey: 'orderId' });

module.exports = {
  User,
  Table,
  MenuItem,
  Order,
  OrderItem,
  Bill
};