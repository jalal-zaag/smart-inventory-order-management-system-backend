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

        // Create demo users - simplified role system (admin and user only)
        const users = [
            { name: 'Admin User', email: 'admin@example.com', password: 'admin123', role: 'admin' },
            { name: 'Demo User', email: 'user@example.com', password: 'user123', role: 'user' }
        ];

        let demoUser;
        for (const userData of users) {
            let user = await User.findOne({ email: userData.email });
            if (!user) {
                // Create new user
                user = await User.create(userData);
                console.log(`✅ ${userData.role.toUpperCase()} user created: ${userData.email}`);
            } else {
                // Delete and recreate to ensure password is correct
                await User.deleteOne({ email: userData.email });
                user = await User.create(userData);
                console.log(`✅ ${userData.role.toUpperCase()} user recreated: ${userData.email}`);
            }
            // Use admin as the demo user for seeding products
            if (userData.role === 'admin') {
                demoUser = user;
            }
        }

        // Create sample categories
        const categories = [
            { name: 'Electronics', description: 'Electronic devices and accessories' },
            { name: 'Clothing', description: 'Apparel and fashion items' },
            { name: 'Grocery', description: 'Food and household items' }
        ];

        for (const cat of categories) {
            let existingCat = await Category.findOne({ name: cat.name });
            if (!existingCat) {
                await Category.create({ ...cat, owner: demoUser._id });
                console.log(`✅ Category "${cat.name}" created`);
            } else {
                // Update owner if needed
                if (existingCat.owner.toString() !== demoUser._id.toString()) {
                    existingCat.owner = demoUser._id;
                    await existingCat.save();
                    console.log(`✅ Category "${cat.name}" updated owner`);
                } else {
                    console.log(`Category "${cat.name}" already exists`);
                }
            }
        }

        // Get category IDs (regardless of owner for seed)
        const electronicsCategory = await Category.findOne({ name: 'Electronics' });
        const clothingCategory = await Category.findOne({ name: 'Clothing' });
        const groceryCategory = await Category.findOne({ name: 'Grocery' });

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
        console.log('  Admin: admin@example.com / admin123');
        console.log('  User:  user@example.com / user123');
        
        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
};

seedDatabase();
