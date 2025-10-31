require('dotenv').config();
const { sequelize } = require('../config/database');
const { User, Table, MenuItem } = require('../models');

const seedDatabase = async () => {
  try {
    await sequelize.sync({ force: true });
    console.log('Database synchronized');
    
    // Create admin user
    await User.create({
      name: 'Admin',
      email: 'admin@restaurant.com',
      password: 'admin123',
      role: 'admin'
    });
    
    // Create waiter
    await User.create({
      name: 'John Waiter',
      email: 'waiter@restaurant.com',
      password: 'waiter123',
      role: 'waiter'
    });
    
    // Create kitchen staff
    await User.create({
      name: 'Chef Kitchen',
      email: 'kitchen@restaurant.com',
      password: 'kitchen123',
      role: 'kitchen'
    });
    
    // Create tables
    for (let i = 1; i <= 20; i++) {
      await Table.create({
        number: i,
        capacity: i <= 10 ? 2 : 4,
        floor: i <= 10 ? 1 : 2,
        section: i <= 10 ? 'A' : 'B'
      });
    }
    
    // Create menu items
    const menuItems = [
      { name: 'Paneer Tikka', category: 'Starters', price: 250, isVeg: true, preparationTime: 15 },
      { name: 'Chicken Wings', category: 'Starters', price: 350, isVeg: false, preparationTime: 20 },
      { name: 'Veg Biryani', category: 'Main Course', price: 280, isVeg: true, preparationTime: 25 },
      { name: 'Chicken Biryani', category: 'Main Course', price: 320, isVeg: false, preparationTime: 25 },
      { name: 'Dal Makhani', category: 'Main Course', price: 220, isVeg: true, preparationTime: 20 },
      { name: 'Butter Chicken', category: 'Main Course', price: 380, isVeg: false, preparationTime: 20 },
      { name: 'Naan', category: 'Breads', price: 40, isVeg: true, preparationTime: 5 },
      { name: 'Garlic Naan', category: 'Breads', price: 50, isVeg: true, preparationTime: 5 },
      { name: 'Gulab Jamun', category: 'Desserts', price: 120, isVeg: true, preparationTime: 5 },
      { name: 'Ice Cream', category: 'Desserts', price: 100, isVeg: true, preparationTime: 2 }
    ];
    
    for (const item of menuItems) {
      await MenuItem.create(item);
    }
    
    console.log('Database seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seedDatabase();