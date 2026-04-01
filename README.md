# Smart Inventory & Order Management System - Backend

## Live Demo

🌐 [https://smart-inventory-order-management-sy.vercel.app/](https://smart-inventory-order-management-sy.vercel.app/)

## Installation

```bash
# Install dependencies
npm install

# Start server
npm start

# Development mode (with nodemon)
npm run dev
```

## Environment Variables

```
NODE_ENV=development
PORT=8080
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRE=30d
```

## Features

### 🔐 1. Authentication & User Management

- **User Registration & Login**
  - Email + Password authentication with JWT tokens
  - Secure password hashing using bcrypt
  - Protected routes with middleware authentication
  - Token expiration: 30 days (configurable)

- **User Profile**
  - Get authenticated user details via `/api/auth/me`
  - Role-based access control (Admin / User)

- **Demo Login**
  - Quick login with pre-filled demo credentials for testing

### 📦 2. Product & Category Management

#### Categories
- **Create Categories**: Organize products by type (e.g., Electronics, Grocery, Clothing)
- **Full CRUD Operations**: Create, Read, Update, Delete categories
- **Category Listing**: View all categories with pagination support
- **Ownership**: Users manage their own categories; admins can manage all

#### Products
- **Add Products Manually** with complete details:
  - Product Name
  - Category (linked reference)
  - Price (auto-validated, non-negative)
  - Stock Quantity
  - Minimum Stock Threshold (default: 5 units)
  - Status: `Active` or `Out of Stock` (auto-updated)

- **Product Operations**:
  - Create, Read, Update, Delete products
  - Search and filter products
  - Pagination support for large datasets
  - Auto-populate category information

- **Smart Stock Status**:
  - Automatic status change to "Out of Stock" when stock reaches 0
  - Auto-reactivate when restocked

### 🛒 3. Order Management

- **Create Orders** with multiple products:
  - Customer Name (required)
  - Multiple items per order
  - Each item includes: Product, Quantity, Price
  - Auto-calculated Total Price
  - Auto-generated Order Number (e.g., `ORD-1234567890-123`)

- **Order Status Workflow**:
  - `Pending` → Order created, awaiting confirmation
  - `Confirmed` → Order verified and processing
  - `Shipped` → Order dispatched
  - `Delivered` → Order completed
  - `Cancelled` → Order cancelled (stock restored)

- **Order Operations**:
  - View all orders with filters (status, date range, search)
  - Update order status
  - Cancel orders (automatic stock restoration)
  - Delete orders
  - Search by order number or customer name
  - Filter by status or date range
  - Pagination for large order lists

### 📊 4. Smart Stock Handling

#### Automatic Stock Deduction
- When placing an order:
  - Stock automatically decreases by ordered quantity
  - Validation ensures sufficient stock availability
  - Prevents orders exceeding available stock

#### Stock Validation & Warnings
- **Insufficient Stock Prevention**:
  - Warning: "Only X items available in stock"
  - Order blocked if requested quantity exceeds stock
  - Real-time stock availability checks

#### Status Auto-Updates
- Stock reaches 0 → Product status becomes "Out of Stock"
- Stock replenished → Product status becomes "Active"

#### Conflict Detection
- **Duplicate Prevention**: Same product cannot be added twice in one order
- **Inactive Product Block**: Prevents ordering products marked as inactive
- **Clear Error Messages**:
  - "This product is already added to the order"
  - "This product is currently unavailable"

### 🔄 5. Restock Queue (Low Stock Management)

- **Automatic Queue Addition**:
  - Products below minimum threshold automatically added to restock queue
  - Priority calculation based on stock levels

- **Queue Management**:
  - View all items needing restock
  - Ordered by lowest stock first
  - Priority levels: High / Medium / Low
  - Filter and search capabilities

- **Restock Operations**:
  - Update stock manually for queued items
  - Remove items from queue after restocking
  - Automatic status updates on restock

### 📈 6. Dashboard & Analytics

- **Key Performance Indicators**:
  - Total Orders Today
  - Pending vs Completed Orders
  - Low Stock Items Count
  - Revenue Today
  - Total Products
  - Total Categories

- **Product Summary**:
  - Stock levels for all products
  - Low stock warnings with visual indicators
  - Quick view: "iPhone 13 — 3 left (Low Stock)"

- **Chart Data**:
  - Order trends over time
  - Revenue analytics
  - Stock level visualizations

### 📝 7. Activity Log

- **Comprehensive Tracking** of recent system actions:
  - Order creation and updates
  - Stock changes
  - Product additions to restock queue
  - Status changes

- **Activity Examples**:
  - `10:15 AM — Order #1023 created`
  - `10:20 AM — Stock updated for "iPhone 13"`
  - `10:30 AM — Product "Headphone" added to Restock Queue`
  - `11:00 AM — Order #1023 marked as Shipped`

- **Features**:
  - Latest 10-50 activities (configurable)
  - Timestamp for each action
  - User attribution
  - Action type categorization

### 🎯 8. Additional Features

#### Search & Filter
- **Products**: Search by name, filter by category or status
- **Orders**: Search by order number or customer name
- **Advanced Filters**: Date range, status, price range

#### Pagination
- All list endpoints support pagination
- Configurable page size (default: 10)
- Total count and page information included
- Optimized for large datasets

#### Role-Based Access
- **Admin Role**: 
  - View and manage all users' data
  - Full system access
  - Global analytics and reports

- **User Role**:
  - Manage own products, categories, and orders
  - Personal dashboard and analytics
  - Isolated data management

#### Data Ownership
- Each resource (product, category, order) linked to owner
- Users can only modify their own data
- Admins have cross-user access for management

#### Security Features
- JWT-based authentication
- Protected API routes
- Password encryption
- Request validation
- Error handling middleware

## API Documentation

### Base URL
```
http://localhost:8080/api
```

### Endpoints Overview

#### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `GET /auth/me` - Get current user (protected)

#### Categories
- `GET /categories` - List all categories (with pagination)
- `POST /categories` - Create category
- `GET /categories/:id` - Get single category
- `PUT /categories/:id` - Update category
- `DELETE /categories/:id` - Delete category

#### Products
- `GET /products` - List all products (with search, filters, pagination)
- `POST /products` - Create product
- `GET /products/:id` - Get single product
- `PUT /products/:id` - Update product
- `DELETE /products/:id` - Delete product

#### Orders
- `GET /orders` - List all orders (with filters, search, pagination)
- `POST /orders` - Create order
- `GET /orders/:id` - Get single order
- `PUT /orders/:id` - Update order status
- `POST /orders/:id/cancel` - Cancel order
- `DELETE /orders/:id` - Delete order

#### Restock Queue
- `GET /restock` - Get restock queue
- `POST /restock/:id/restock` - Restock product
- `DELETE /restock/:id` - Remove from queue

#### Dashboard
- `GET /dashboard/stats` - Get dashboard statistics
- `GET /dashboard/activities` - Get recent activities
- `GET /dashboard/chart-data` - Get chart data for analytics

#### Activity Logs
- `GET /activity-logs` - List activity logs
- `GET /activity-logs/:id` - Get single activity log

## Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Password Security**: bcrypt
- **Validation**: Express built-in & Mongoose validators
- **Architecture**: RESTful API with MVC pattern
