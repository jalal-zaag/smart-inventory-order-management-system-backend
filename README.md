# Smart Inventory & Order Management System - Backend

RESTful API for managing inventory, orders, and stock with automatic restock queue management.

## Features

- 🔐 JWT Authentication (Register, Login)
- 📦 Product Management with stock tracking
- 🏷️ Category Management
- 🛒 Order Management with automatic stock deduction
- ⚠️ Restock Queue for low stock items
- 📊 Dashboard Statistics
- 📝 Activity Logging
- ✅ Stock validation and conflict detection

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose ODM)
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcryptjs

## Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Update .env with your MongoDB URI and JWT secret

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

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (Protected)

### Categories
- `GET /api/categories` - Get all categories (Protected)
- `GET /api/categories/:id` - Get single category (Protected)
- `POST /api/categories` - Create category (Protected)
- `PUT /api/categories/:id` - Update category (Protected)
- `DELETE /api/categories/:id` - Delete category (Protected)

### Products
- `GET /api/products` - Get all products (Protected)
  - Query params: `category`, `status`, `search`
- `GET /api/products/:id` - Get single product (Protected)
- `POST /api/products` - Create product (Protected)
- `PUT /api/products/:id` - Update product (Protected)
- `DELETE /api/products/:id` - Delete product (Protected)

### Orders
- `GET /api/orders` - Get all orders (Protected)
  - Query params: `status`, `customerName`, `startDate`, `endDate`
- `GET /api/orders/:id` - Get single order (Protected)
- `POST /api/orders` - Create order (Protected)
- `PUT /api/orders/:id` - Update order status (Protected)
- `POST /api/orders/:id/cancel` - Cancel order & restore stock (Protected)
- `DELETE /api/orders/:id` - Delete order (Protected)

### Restock Queue
- `GET /api/restock-queue` - Get restock queue (Protected)
- `POST /api/restock-queue/:id/restock` - Restock product (Protected)
- `DELETE /api/restock-queue/:id` - Remove from queue (Protected)

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics (Protected)
- `GET /api/dashboard/activities` - Get recent activities (Protected)

## Response Format

All responses follow this structure:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

Error responses:
```json
{
  "success": false,
  "message": "Error message"
}
```

## Business Logic

### Stock Management
- Stock automatically deducted when order is created
- Stock restored when order is cancelled
- Product status auto-updates to "Out of Stock" when stock reaches 0
- Product status auto-updates to "Active" when stock is added

### Restock Queue
- Products automatically added to queue when stock < minStockThreshold
- Priority calculated based on stock deficit:
  - **High**: Stock is 0 or deficit >= 50% of threshold
  - **Medium**: Deficit >= 25% of threshold
  - **Low**: Deficit < 25% of threshold
- Queue ordered by: priority → current stock → added date

### Order Validation
- Prevents duplicate products in same order
- Validates stock availability before order creation
- Prevents ordering inactive products
- Shows specific error messages for each validation

### Activity Logging
- Automatically logs all CRUD operations
- Tracks user actions with timestamps
- Includes metadata for important operations

## Architecture Pattern

Follows **MVC Pattern**:
- **Models**: MongoDB schemas with validation
- **Controllers**: Business logic with error handling
- **Routes**: API endpoint definitions
- **Middleware**: Authentication (JWT)

## Demo Account

For testing, create a demo account:
```json
{
  "name": "Demo User",
  "email": "demo@example.com",
  "password": "demo123"
}
```

## Author

Smart Inventory System Backend API
