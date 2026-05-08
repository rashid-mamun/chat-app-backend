# Chat App Backend — Production-Ready Real-Time Chat API

A fully-featured, production-ready **Node.js + Socket.IO** backend for real-time chat applications. Supports private messaging, group chats, file uploads, 2FA authentication, message search, presence tracking, and more — with **163 passing tests**, **83%+ code coverage**, and complete security hardening as of 2026-05-07.

![Node.js](https://img.shields.io/badge/Node.js-18+-green) ![MongoDB](https://img.shields.io/badge/MongoDB-6+-brightgreen) ![Redis](https://img.shields.io/badge/Redis-7+-red) ![Tests](https://img.shields.io/badge/Tests-163%20passing-brightgreen) ![Coverage](https://img.shields.io/badge/Coverage-83%25+-blue)

---

## 🎯 Features at a Glance

### Core Messaging
- ✅ Private 1-on-1 messaging with real-time delivery via WebSockets
- ✅ Group chats with admin-controlled membership
- ✅ Message reactions (👍 ❤️ 😂 😮 😢 🔥)
- ✅ Read receipts (✓ sent, ✓✓ read)
- ✅ Typing indicators
- ✅ Message editing and soft-deletion (audit trail preserved)
- ✅ Message pinning (group admins)
- ✅ Automatic compression for long messages (zlib deflate)

### Authentication & Security
- ✅ JWT access tokens (15-min) + refresh tokens (7-day) with Redis blacklisting
- ✅ Two-Factor Authentication (TOTP) — Google Authenticator compatible
- ✅ Password hashing (bcrypt with 12 salt rounds)
- ✅ Rate limiting (5 auth attempts per 15 min, 30 messages per min)
- ✅ Input sanitization (XSS, NoSQL injection, parameter pollution)
- ✅ Helmet security headers, CORS, CSP policies
- ✅ Token blacklisting on logout — revoked tokens are rejected
- ✅ Session invalidation on password change

### Presence & Real-Time
- ✅ Online/offline status tracking
- ✅ Last seen timestamps
- ✅ Typing indicators (private + group)
- ✅ Presence broadcasts on connect/disconnect

### Search & Discovery
- ✅ Full-text message search (basic keyword)
- ✅ Advanced search with date range and file type filters
- ✅ User discovery (search by username/email)

### File Management
- ✅ File upload with MIME type validation (max 10MB)
- ✅ Supported types: images (JPEG, PNG, GIF, WebP), PDF, documents (DOC, DOCX), spreadsheets (XLS, XLSX), text files
- ✅ Static file serving at `/uploads`
- ✅ File metadata in messages (name, size, type)

### Admin Features (Group Management)
- ✅ Create groups with auto-admin creator
- ✅ Add/remove members
- ✅ Promote/demote admins
- ✅ Delete groups (admin only)

### Logging & Monitoring
- ✅ Structured logging with Winston (console-only output, respects `LOG_LEVEL`)
- ✅ Error tracking with stack traces
- ✅ API health endpoint with MongoDB & Redis connectivity checks
- ✅ Comprehensive test coverage (163 tests, 83%+)

---

## 🏗️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Node.js 18+ | JavaScript runtime |
| **HTTP** | Express.js | REST routing and middleware |
| **Real-Time** | Socket.IO v4.6 + Redis Adapter | WebSocket pub/sub |
| **Primary DB** | MongoDB 6+ via Mongoose | Users, messages, groups |
| **Cache/Session** | Redis 7+ (ioredis) | Tokens, rate limits, socket pub/sub |
| **Auth** | JWT (jsonwebtoken) | Access and refresh tokens |
| **2FA** | TOTP (otplib) | Google Authenticator compatible |
| **Password** | bcryptjs | Secure password hashing |
| **Uploads** | Multer + disk storage | File uploads |
| **Validation** | express-validator | Input validation and sanitization |
| **Security** | Helmet, CORS, XSS-clean, express-mongo-sanitize, HPP | Security middleware |
| **Rate Limiting** | express-rate-limit | Brute-force and spam protection |
| **Logging** | Winston | Structured console logging |
| **Testing** | Jest, Supertest, mongodb-memory-server, socket.io-client | Unit, integration, socket tests |
| **Compression** | Node.js zlib | Auto-compress long messages |
| **Job Queue** | BullMQ (Redis-backed) | Background jobs |
| **Containerization** | Docker + Docker Compose | Local and deployment setup |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** >= 16 (tested on 18+)
- **MongoDB** >= 6
- **Redis** >= 7
- **npm** or **yarn**

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/rashid-mamun/chat-app-backend.git
cd chat-app-backend
npm install
```

### 2. Set Up Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
NODE_ENV=development
PORT=5000
API_VERSION=v1

# MongoDB
MONGO_URI=mongodb://localhost:27017/chat-app

# Redis
REDIS_URL=redis://localhost:6379

# JWT — Use long random strings (min 32 chars)
JWT_SECRET=your_super_secret_access_token_key_at_least_32_characters_long
JWT_REFRESH_SECRET=your_super_secret_refresh_token_key_at_least_32_characters_long
JWT_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d

# CORS — Comma-separated frontend URLs
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Logging
LOG_LEVEL=info
# Valid levels: error, warn, info, http, debug, verbose, silly
```

**⚠️ IMPORTANT:** Generate strong JWT secrets:

### 3. Start Services

#### Option A — Docker (Recommended for local dev)
```bash
docker-compose up --build
# Starts: API (5000), MongoDB (27017), Redis (6379)
```

#### Option B — Local Development (Manual)
```bash
# Terminal 1 — MongoDB
mongod

# Terminal 2 — Redis
redis-server

# Terminal 3 — Node app with auto-reload
npm run dev

# Or for production:
npm start
```

### 4. Verify Server is Running

```bash
curl http://localhost:5000/api/v1/health

# Expected response:
{
  "status": "healthy",
  "mongodb": "connected",
  "redis": "connected",
  "uptime": "0.5s",
  "timestamp": "2026-05-07T14:23:45.123Z"
}
```

---

## 📁 Project Structure

```
chat-app-backend/
│
├── src/
│   ├── config/                    # Database & service configurations
│   │   ├── database.js            # MongoDB connection (Mongoose)
│   │   ├── redis.js               # Redis client setup (ioredis)
│   │   └── socket.js              # Socket.IO server config
│   │
│   ├── controllers/               # Request handlers (thin layer, delegates to services)
│   │   ├── authController.js      # Auth endpoints (register, login, 2FA)
│   │   ├── chatController.js      # Chat endpoints (messages, search, upload)
│   │   ├── groupController.js     # Group endpoints (create, members, admins)
│   │   └── userController.js      # User endpoints (search, profile)
│   │
│   ├── middleware/                # Express middleware (security, auth, validation)
│   │   ├── auth.js                # JWT verification & optional auth
│   │   ├── errorHandler.js        # Global error handler with AppError class
│   │   ├── rateLimiter.js         # Rate limiting configs (auth, messages)
│   │   ├── security.js            # Helmet, CORS, sanitizers, CSP
│   │   └── validation.js          # express-validator rule chains
│   │
│   ├── models/                    # Mongoose schemas & methods
│   │   ├── User.js                # User: username, email, password, 2FA, status, presence
│   │   ├── Message.js             # Message: content, sender, recipient/group, reactions, readBy, compress
│   │   └── Group.js               # Group: name, members[], admins[], privacy
│   │
│   ├── routes/                    # Route definitions (HTTP methods + controller bindings)
│   │   ├── auth.js                # /api/v1/auth/*
│   │   ├── chat.js                # /api/v1/chat/*
│   │   ├── group.js               # /api/v1/group/*
│   │   ├── user.js                # /api/v1/users/*
│   │   ├── upload.js              # /api/v1/upload/*
│   │   └── health.js              # /api/v1/health
│   │
│   ├── services/                  # Business logic layer (all DB/Redis operations)
│   │   ├── authService.js         # register, login, 2FA, profile, password reset
│   │   ├── chatService.js         # message CRUD, search, soft-delete, compression
│   │   └── fileService.js         # Multer config for file uploads
│   │
│   ├── sockets/                   # Socket.IO real-time event handlers
│   │   └── socketHandlers.js      # Auth + handlers (join, message, reaction, typing, etc)
│   │
│   ├── tests/                     # Comprehensive test suite (Jest + Supertest)
│   │   ├── controllers/           # Controller integration tests
│   │   ├── e2e/                   # End-to-end tests (API + socket flow)
│   │   ├── services/              # Service unit tests
│   │   ├── sockets/               # Socket.IO event tests
│   │   ├── utils/                 # Utility function tests
│   │   ├── validators/            # Input validation tests
│   │   └── setup.js               # Global test configuration (in-memory MongoDB + Redis mock)
│   │
│   ├── utils/                     # Utility functions
│   │   ├── logger.js              # Winston logger (console-only, respects LOG_LEVEL)
│   │   ├── fileUpload.js          # Multer configuration for disk storage
│   │   └── queue.js               # BullMQ job queue backed by Redis
│   │
│   └── validators/                # Input validation rule definitions
│       ├── authValidator.js       # Validation chains for auth endpoints
│       ├── chatValidator.js       # Validation chains for chat endpoints
│       └── groupValidator.js      # Validation chains for group endpoints
│
├── uploads/                       # User-uploaded files (served at /uploads)
│
├── server.js                      # Application entry point & Express setup
├── jest.config.js                 # Jest testing configuration
├── .env                           # Environment variables (DO NOT COMMIT)
├── .env.test                      # Test environment config
├── docker-compose.yml             # Docker multi-service setup
├── Dockerfile                     # Docker image build config
└── README.md                      # This file
```

---

## 📡 API Reference

### Base URL
```
http://localhost:5000/api/v1
```

**Authentication:** Most endpoints require `Authorization: Bearer <access_token>` header.

### Authentication Endpoints `/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/register` | — | Register a new user and return tokens |
| `POST` | `/auth/login` | — | Login and return tokens; supports `twoFactorToken` |
| `POST` | `/auth/logout` | 🔒 | Invalidate token & clear Redis session |
| `POST` | `/auth/refresh-token` | — | Exchange refresh token for a new access token |
| `POST` | `/auth/2fa/setup` | 🔒 | Get 2FA secret and QR code |
| `POST` | `/auth/2fa/verify` | 🔒 | Verify TOTP code & enable 2FA |
| `GET` | `/auth/profile` | 🔒 | Get the current user profile |
| `PUT` | `/auth/profile` | 🔒 | Update username, avatar, or bio |
| `PUT` | `/auth/change-password` | 🔒 | Change password and invalidate refresh tokens |
| `POST` | `/auth/forgot-password` | — | Send a password reset link |
| `POST` | `/auth/reset-password/:token` | — | Reset password with a token |

**Rate Limit:** 5 auth requests per 15 minutes

### Chat Endpoints `/chat`

| Method | Endpoint | Auth | Parameters | Description |
|--------|----------|------|------------|-------------|
| `GET` | `/chat/private/:recipientId` | 🔒 | `page=1&limit=20` | Get private message history |
| `GET` | `/chat/group/:groupId` | 🔒 | `page=1&limit=20` | Get group message history |
| `GET` | `/chat/user` | 🔒 | — | Get all chats for the current user |
| `GET` | `/chat/messages/search` | 🔒 | `query=text&chatType=private&chatId=...&page=1` | Search messages by keyword |
| `GET` | `/chat/messages/search/advanced` | 🔒 | `query=...&chatType=&startDate=&endDate=&fileType=` | Search with filters |
| `POST` | `/chat/messages/:messageId/pin` | 🔒 | — | Pin a message |
| `PUT` | `/chat/messages/:messageId` | 🔒 | `{ "content": "..." }` | Edit a message |
| `DELETE` | `/chat/messages/:messageId` | 🔒 | — | Soft-delete a message |
| `POST` | `/chat/upload` | 🔒 | multipart: `file` | Upload a file |
| `POST` | `/chat/clear` | 🔒 | `{ "chatType": "private", "chatId": "..." }` | Soft-delete all messages in a chat |

**Rate Limit:** 30 message-related requests per minute

### Group Endpoints `/group`

| Method | Endpoint | Auth | Body | Description |
|--------|----------|------|------|-------------|
| `POST` | `/group` | 🔒 | `{ "name": "...", "members": [...] }` | Create a group and make the creator admin |
| `GET` | `/group` | 🔒 | — | List the groups the user belongs to |
| `GET` | `/group/:groupId` | 🔒 | — | Get group details |
| `PUT` | `/group/:groupId` | 🔒 Admin | `{ "name": "..." }` | Update the group name |
| `DELETE` | `/group/:groupId` | 🔒 Admin | — | Delete the group |
| `POST` | `/group/:groupId/members` | 🔒 Admin | `{ "memberId": "..." }` | Add a member |
| `DELETE` | `/group/:groupId/members/:memberId` | 🔒 Admin | — | Remove a member |
| `POST` | `/group/:groupId/admins` | 🔒 Admin | `{ "adminId": "..." }` | Promote a member to admin |
| `DELETE` | `/group/:groupId/admins/:adminId` | 🔒 Admin | — | Demote an admin |

### User Endpoints `/users`

| Method | Endpoint | Auth | Parameters | Description |
|--------|----------|------|------------|-------------|
| `GET` | `/users/search` | 🔒 | `query=john` | Search users by username or email |
| `GET` | `/users` | 🔒 | `?page=1&limit=10` | Get paginated users |

### Health Endpoint `/health`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/health` | — | Server status, MongoDB & Redis connectivity, uptime |

---

## 🔌 Socket.IO Real-Time Events

### Connection
```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: { token: '<your_access_token>' },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});
```

### Events Emitted by Client

| Event | Payload | Description |
|-------|---------|-------------|
| `joinPrivateChat` | `{ recipientId: "..." }` | Join a private chat room |
| `joinGroupChat` | `{ groupId: "..." }` | Join a group chat room |
| `sendPrivateMessage` | `{ recipientId: "...", content: "...", fileUrl?: "...", replyTo?: "..." }` | Send a private message |
| `sendGroupMessage` | `{ groupId: "...", content: "...", fileUrl?: "...", replyTo?: "..." }` | Send a group message |
| `markMessageAsRead` | `{ messageId: "..." }` | Mark a message as read |
| `addReaction` | `{ messageId: "...", reaction: "👍" \| "❤️" \| "😂" \| "😮" \| "😢" \| "🔥" }` | React to a message |
| `typing` | `{ chatType: "private" \| "group", recipientId?: "...", groupId?: "..." }` | Broadcast typing status |
| `stopTyping` | `{ chatType: "private" \| "group", recipientId?: "...", groupId?: "..." }` | Broadcast typing stopped |
| `groupAction` | `{ type: "invite" \| "joinRequest" \| "memberUpdate", groupId, targetUserId?, details? }` | Group actions |

### Events Received by Client

| Event | Payload | Description |
|-------|---------|-------------|
| `joinedPrivateChat` | `{ room: "...", recipientId: "..." }` | Confirm private room join |
| `joinedGroupChat` | `{ groupId: "..." }` | Confirm group room join |
| `newPrivateMessage` | Message object | Receive a private message |
| `newGroupMessage` | Message object | Receive a group message |
| `messageRead` | `{ messageId: "...", readBy: "..." }` | Message read update |
| `messageReactionUpdated` | `{ messageId: "...", reactions: [...] }` | Reaction update |
| `userTyping` | `{ userId: "...", username: "..." }` | Someone is typing |
| `userStoppedTyping` | `{ userId: "..." }` | Someone stopped typing |
| `userStatusChanged` | `{ userId: "...", isOnline: true \| false }` | User online/offline status |
| `error` | `{ message: "..." }` | Socket error |

---

## 🧪 Testing

The backend includes **163 comprehensive tests** covering all major features, with **83%+ code coverage**.

### Run Tests

```bash
# All tests (watch mode: add --watch)
npm test

# With coverage report
npm test -- --coverage

# Specific test file
npx jest src/tests/controllers/authController.test.js --no-coverage

# Watch mode (re-run on changes)
npm test -- --watch
```

## 📝 API Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // ... response payload
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "status": 400
}
```

### Validation Error
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```
## Docker

```bash
# Build and start all services (app + MongoDB + Redis)
docker-compose up --build

# Background mode
docker-compose up -d

# Stop everything
docker-compose down

# View logs
docker-compose logs -f app
```

Services defined in `docker-compose.yml`:
- `app` — Node.js backend (port 5000)
- `mongo` — MongoDB (port 27017)
- `redis` — Redis (port 6379)

---

## Security Notes

- Passwords are **never stored in plaintext** — bcrypt hash only
- Access tokens expire in **15 minutes**; refresh tokens in **7 days**
- On logout, access tokens are **blacklisted in Redis** until their natural expiry
- **Rate limiting** blocks brute-force: 5 auth attempts per 15 minutes per IP
- All inputs pass through **XSS cleaning**, **NoSQL injection sanitization**, and **HTTP parameter pollution protection**
- CORS is restricted to explicitly configured origins only

---

## License

MIT © [Rashid Mamun](https://github.com/rashid-mamun)
