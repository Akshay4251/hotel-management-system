const { sequelize } = require('../config/database');
const { User, Table, MenuItem, Order, OrderItem, Bill } = require('../models');
const bcrypt = require('bcryptjs');

async function seed() {
  try {
    console.log('🌱 Starting database seed...');
    
    // Sync database (be careful in production!)
    await sequelize.sync({ force: true });
    console.log('✅ Database synced');
    
    // ============================================
    // CREATE USERS
    // ============================================
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const users = await User.bulkCreate([
      {
        name: 'Admin User',
        email: 'admin@hotel.com',
        password: hashedPassword,
        role: 'admin',
        phone: '1234567890'
      },
      {
        name: 'Waiter 1',
        email: 'waiter@hotel.com',
        password: hashedPassword,
        role: 'waiter',
        phone: '9876543210'
      },
      {
        name: 'Kitchen Staff',
        email: 'kitchen@hotel.com',
        password: hashedPassword,
        role: 'kitchen',
        phone: '5555555555'
      }
    ]);
    
    console.log(`✅ Created ${users.length} users`);
    
    // ============================================
    // CREATE TABLES
    // ============================================
    const tables = [];
    for (let i = 1; i <= 20; i++) {
      tables.push({
        number: i,
        capacity: i <= 10 ? 4 : 6,
        status: 'available',
        floor: i <= 10 ? 1 : 2
      });
    }
    
    const createdTables = await Table.bulkCreate(tables);
    console.log(`✅ Created ${createdTables.length} tables`);
    
    // ============================================
    // CREATE MENU ITEMS
    // ============================================
    const menuItems = await MenuItem.bulkCreate([
      // Starters
      {
        name: 'Paneer Tikka',
        description: 'Grilled cottage cheese with Indian spices',
        category: 'Starters',
        price: 299.00,
        isVeg: true,
        isAvailable: true,
        preparationTime: 15,
        spiceLevel: 'medium',
        tags: ['popular', 'grilled']
      },
      {
        name: 'Chicken Wings',
        description: 'Crispy fried chicken wings with BBQ sauce',
        category: 'Starters',
        price: 349.00,
        isVeg: false,
        isAvailable: true,
        preparationTime: 20,
        spiceLevel: 'mild',
        tags: ['popular']
      },
      {
        name: 'Spring Rolls',
        description: 'Crispy vegetable spring rolls',
        category: 'Starters',
        price: 199.00,
        isVeg: true,
        isAvailable: true,
        preparationTime: 10,
        tags: ['quick']
      },
      
      // Main Course
      {
        name: 'Butter Chicken',
        description: 'Creamy tomato curry with tender chicken',
        category: 'Main Course',
        price: 399.00,
        isVeg: false,
        isAvailable: true,
        preparationTime: 25,
        spiceLevel: 'medium',
        tags: ['popular', 'chef-special']
      },
      {
        name: 'Dal Makhani',
        description: 'Slow-cooked black lentils with cream',
        category: 'Main Course',
        price: 279.00,
        isVeg: true,
        isAvailable: true,
        preparationTime: 20,
        spiceLevel: 'mild',
        tags: ['popular']
      },
      {
        name: 'Biryani',
        description: 'Fragrant rice with chicken and spices',
        category: 'Main Course',
        price: 449.00,
        isVeg: false,
        isAvailable: true,
        preparationTime: 30,
        spiceLevel: 'medium',
        tags: ['popular', 'chef-special']
      },
      {
        name: 'Palak Paneer',
        description: 'Cottage cheese in spinach gravy',
        category: 'Main Course',
        price: 299.00,
        isVeg: true,
        isAvailable: true,
        preparationTime: 20,
        spiceLevel: 'mild'
      },
      
      // Breads
      {
        name: 'Garlic Naan',
        description: 'Tandoor-baked bread with garlic',
        category: 'Breads',
        price: 69.00,
        isVeg: true,
        isAvailable: true,
        preparationTime: 10,
        tags: ['popular']
      },
      {
        name: 'Butter Roti',
        description: 'Whole wheat flatbread with butter',
        category: 'Breads',
        price: 39.00,
        isVeg: true,
        isAvailable: true,
        preparationTime: 8
      },
      
      // Desserts
      {
        name: 'Gulab Jamun',
        description: 'Sweet dumplings in sugar syrup',
        category: 'Desserts',
        price: 149.00,
        isVeg: true,
        isAvailable: true,
        preparationTime: 5,
        tags: ['popular']
      },
      {
        name: 'Ice Cream',
        description: 'Assorted flavors',
        category: 'Desserts',
        price: 99.00,
        isVeg: true,
        isAvailable: true,
        preparationTime: 2,
        tags: ['quick']
      },
      
      // Beverages
      {
        name: 'Mango Lassi',
        description: 'Sweet yogurt drink with mango',
        category: 'Beverages',
        price: 99.00,
        isVeg: true,
        isAvailable: true,
        preparationTime: 5,
        tags: ['popular', 'quick']
      },
      {
        name: 'Masala Chai',
        description: 'Indian spiced tea',
        category: 'Beverages',
        price: 49.00,
        isVeg: true,
        isAvailable: true,
        preparationTime: 5,
        tags: ['quick']
      },
      {
        name: 'Fresh Lime Soda',
        description: 'Refreshing lime and soda drink',
        category: 'Beverages',
        price: 79.00,
        isVeg: true,
        isAvailable: true,
        preparationTime: 3,
        tags: ['quick']
      }
    ]);
    
    console.log(`✅ Created ${menuItems.length} menu items`);
    
    // Log all menu item IDs for reference
    console.log('\n📋 MENU ITEM IDS (for testing):');
    menuItems.forEach(item => {
      console.log(`  ${item.name}: ${item.id}`);
    });
    
    console.log('\n🎉 Seed completed successfully!');
    console.log(`
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    📊 DATABASE SEEDED
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Users: ${users.length}
    Tables: ${createdTables.length}
    Menu Items: ${menuItems.length}
    
    🔐 Login Credentials:
    Email: admin@hotel.com
    Password: admin123
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

seed();