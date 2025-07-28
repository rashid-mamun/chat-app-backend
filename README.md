# Chat App Backend

A robust, real-time chat application backend built with Node.js, Express.js, and Socket.IO. This backend provides comprehensive chat functionality including private messaging, group chats, file sharing, message search, and two-factor authentication.

## Description

This is a full-featured chat application backend that supports real-time messaging, group management, file uploads, message search, and enhanced security features. The application is built with scalability and security in mind, featuring JWT authentication, rate limiting, input validation, and comprehensive error handling.

## Features

### 🔐 Authentication & Security
- **JWT-based authentication** with refresh tokens
- **Two-Factor Authentication (TOTP)** with QR code generation
- **Password validation** with strong requirements
- **Rate limiting** to prevent abuse
- **Input validation** and sanitization
- **XSS protection** and security headers

### 💬 Messaging
- **Private messaging** between users
- **Group messaging** with member management
- **Real-time messaging** via Socket.IO
- **Message reactions** (like, love, laugh, sad, angry)
- **Message editing** and deletion
- **Message pinning** in groups
- **Read receipts** and delivery status
- **Message compression** for large content

### 📁 File Management
- **File uploads** with type validation
- **Multiple file types** support (images, videos, documents, etc.)
- **File size limits** and validation
- **Secure file storage** with proper naming

### 🔍 Search & Discovery
- **Basic message search** by content
- **Advanced search** with filters (date range, file type, sender)
- **User search** and discovery
- **Group search** and management

### 👥 Group Management
- **Create and manage groups**
- **Add/remove members**
- **Admin management** with permissions
- **Group settings** and customization

### 📊 Monitoring & Health
- **Health check endpoints** for monitoring
- **Comprehensive logging** with Winston
- **Error tracking** and reporting
- **Performance monitoring**

## Technologies Used

### Backend Framework
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **Socket.IO** - Real-time bidirectional communication

### Database & Caching
- **MongoDB** - NoSQL database with Mongoose ODM
- **Redis** - In-memory data store for caching and sessions

### Authentication & Security
- **JWT (jsonwebtoken)** - Token-based authentication
- **bcryptjs** - Password hashing
- **otplib** - Two-factor authentication (TOTP)
- **qrcode** - QR code generation for 2FA

### File Handling
- **Multer** - File upload middleware
- **Compression** - Data compression utilities

### Security Middleware
- **Helmet** - Security headers
- **CORS** - Cross-origin resource sharing
- **express-rate-limit** - Rate limiting
- **express-mongo-sanitize** - MongoDB injection protection
- **xss-clean** - XSS protection
- **hpp** - HTTP parameter pollution protection

### Validation & Utilities
- **express-validator** - Input validation
- **validator** - Data validation library
- **Winston** - Logging framework

### Testing
- **Jest** - Testing framework
- **Supertest** - HTTP assertion testing
- **mongodb-memory-server** - In-memory MongoDB for testing
- **socket.io-client** - Socket.IO client for testing

### Development & Deployment
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **Nodemon** - Development server with auto-restart

## Installation

### Prerequisites
- Node.js (>= 16.0.0)
- MongoDB
- Redis
- npm or yarn

### Step-by-Step Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/rashid-mamun/chat-app-backend.git
   cd chat-app-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create environment file**
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables** (see Environment Variables section)

5. **Start MongoDB and Redis**
   ```bash
   # Using Docker (recommended)
   docker-compose up -d mongo redis
   
   # Or start them manually
   mongod
   redis-server
   ```

6. **Run database migrations** (if any)
   ```bash
   npm run migrate
   ```

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
NODE_ENV=development
PORT=5000

# Database Configuration
MONGO_URI=mongodb://localhost:27017/chat-app
MONGO_URI_TEST=mongodb://localhost:27017/chat-app-test

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_URL_TEST=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# File Upload Configuration
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=jpeg,jpg,png,gif,pdf,doc,docx,txt,plain

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log

# 2FA Configuration
TOTP_ISSUER=ChatApp
TOTP_LABEL=ChatApp_2FA
```

## Running the Project

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

### Using Docker
```bash
# Build and run all services
docker-compose up --build

# Run in background
docker-compose up -d

# Stop services
docker-compose down
```

### Health Check
Once the server is running, you can check if everything is working:
```bash
curl http://localhost:5000/api/v1/health
```

## API Endpoints

### Authentication Endpoints

#### Register User
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "user_id",
      "username": "john_doe",
      "email": "john@example.com"
    },
    "tokens": {
      "accessToken": "jwt_token",
      "refreshToken": "refresh_token"
    }
  }
}
```

#### Login User
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

#### Setup 2FA
```http
POST /api/v1/auth/2fa/setup
Authorization: Bearer <access_token>
```

#### Verify 2FA
```http
POST /api/v1/auth/2fa/verify
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "token": "123456"
}
```

#### Get Profile
```http
GET /api/v1/auth/profile
Authorization: Bearer <access_token>
```

#### Update Profile
```http
PUT /api/v1/auth/profile
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "username": "new_username",
  "avatar": "avatar_url"
}
```

#### Change Password
```http
PUT /api/v1/auth/change-password
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "currentPassword": "old_password",
  "newPassword": "new_secure_password"
}
```

### Chat Endpoints

#### Get Private Messages
```http
GET /api/v1/chat/private/:recipientId?page=1&limit=20
Authorization: Bearer <access_token>
```

#### Get Group Messages
```http
GET /api/v1/chat/group/:groupId?page=1&limit=20
Authorization: Bearer <access_token>
```

#### Get User Chats
```http
GET /api/v1/chat/user
Authorization: Bearer <access_token>
```

#### Search Messages
```http
GET /api/v1/chat/messages/search?query=hello&chatType=private&chatId=recipient_id
Authorization: Bearer <access_token>
```

#### Advanced Message Search
```http
GET /api/v1/chat/messages/search/advanced?query=hello&chatType=private&chatId=recipient_id&startDate=2024-01-01&endDate=2024-12-31&fileType=image
Authorization: Bearer <access_token>
```

#### Pin Message
```http
POST /api/v1/chat/messages/:messageId/pin
Authorization: Bearer <access_token>
```

#### Edit Message
```http
PUT /api/v1/chat/messages/:messageId
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "content": "Updated message content"
}
```

#### Delete Message
```http
DELETE /api/v1/chat/messages/:messageId
Authorization: Bearer <access_token>
```

#### Upload File
```http
POST /api/v1/chat/upload
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

file: <file>
```

### Group Endpoints

#### Create Group
```http
POST /api/v1/group
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "My Group",
  "members": ["user_id_1", "user_id_2"]
}
```

#### Get Groups
```http
GET /api/v1/group
Authorization: Bearer <access_token>
```

#### Get Group Details
```http
GET /api/v1/group/:groupId
Authorization: Bearer <access_token>
```

#### Update Group
```http
PUT /api/v1/group/:groupId
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "Updated Group Name"
}
```

#### Delete Group
```http
DELETE /api/v1/group/:groupId
Authorization: Bearer <access_token>
```

#### Add Member
```http
POST /api/v1/group/:groupId/members
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "memberId": "user_id"
}
```

#### Remove Member
```http
DELETE /api/v1/group/:groupId/members/:memberId
Authorization: Bearer <access_token>
```

#### Add Admin
```http
POST /api/v1/group/:groupId/admins
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "adminId": "user_id"
}
```

#### Remove Admin
```http
DELETE /api/v1/group/:groupId/admins/:adminId
Authorization: Bearer <access_token>
```

### Health Endpoint

#### Health Check
```http
GET /api/v1/health
```

**Response:**
```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600,
  "services": {
    "mongodb": {
      "status": "connected"
    },
    "redis": {
      "status": "connected"
    }
  }
}
```

## Testing

### Run All Tests
```bash
npm test
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Test Structure
- **Unit Tests**: Individual function testing
- **Integration Tests**: API endpoint testing
- **Socket Tests**: Real-time communication testing
- **Database Tests**: Using in-memory MongoDB

### Test Coverage
The project maintains high test coverage across:
- Authentication flows
- Chat functionality
- Group management
- File uploads
- Message search
- Socket.IO handlers
- Error handling



