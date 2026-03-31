// Run this script to create a demo user: node seed.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');
const Category = require('./models/Category');
const Product = require('./models/Product');

const seedDatabase = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Check if demo user exists
        let demoUser = await User.findOne({ email: 'demo@example.com' });
        
        if (!demoUser) {
            demoUser = await User.create({
                name: 'Demo User',
                email: 'demo@example.com',
                password: 'demo123'
            });
            console.log('✅ Demo user created');
        } else {
            console.log('Demo user already exists');
        }

        // Create sample categories
        const categories = [
            { name: 'Electronics', description: 'Electronic devices and accessories' },
            { name: 'Clothing', description: 'Apparel and fashion items' },
            { name: 'Grocery', description: 'Food and household items' }
        ];

        for (const cat of categories) {
            const exists = await Category.findOne({ name: cat.name, owner: demoUser._id });
            if (!exists) {
                await Category.create({ ...cat, owner: demoUser._id });
                console.log(`✅ Category "${cat.name}" created`);
            }
        }

        // Get category IDs
        const electronicsCategory = await Category.findOne({ name: 'Electronics', owner: demoUser._id });
        const clothingCategory = await Category.findOne({ name: 'Clothing', owner: demoUser._id });
        const groceryCategory = await Category.findOne({ name: 'Grocery', owner: demoUser._id });

        // Create sample products
        const products = [
            { name: 'iPhone 15', category: electronicsCategory._id, categoryName: 'Electronics', price: 999, stockQuantity: 3, minStockThreshold: 5 },
            { name: 'Samsung Galaxy S24', category: electronicsCategory._id, categoryName: 'Electronics', price: 899, stockQuantity: 10, minStockThreshold: 5 },
            { name: 'MacBook Pro', category: electronicsCategory._id, categoryName: 'Electronics', price: 1999, stockQuantity: 7, minStockThreshold: 3 },
            { name: 'T-Shirt (Black)', category: clothingCategory._id, categoryName: 'Clothing', price: 25, stockQuantity: 50, minStockThreshold: 10 },
            { name: 'Jeans (Blue)', category: clothingCategory._id, categoryName: 'Clothing', price: 45, stockQuantity: 30, minStockThreshold: 8 },
            { name: 'Rice (5kg)', category: groceryCategory._id, categoryName: 'Grocery', price: 12, stockQuantity: 100, minStockThreshold: 20 },
            { name: 'Cooking Oil', category: groceryCategory._id, categoryName: 'Grocery', price: 8, stockQuantity: 2, minStockThreshold: 10 }
        ];

        for (const prod of products) {
            const exists = await Product.findOne({ name: prod.name, owner: demoUser._id });
            if (!exists) {
                await Product.create({ ...prod, owner: demoUser._id });
                console.log(`✅ Product "${prod.name}" created`);
            }
        }

        console.log('\n🎉 Database seeded successfully!');
        console.log('\nDemo Credentials:');
        console.log('  Email: demo@example.com');
        console.log('  Password: demo123');
        
        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
};

seedDatabase();
