# Chat App Backend

A production-ready, real-time chat application backend built with **Node.js**, **Express.js**, **Socket.IO**, **MongoDB**, and **Redis**. The system supports private messaging, group chats, file uploads, message search, two-factor authentication, and live presence tracking — all fully tested with **163 passing tests** and **83%+ code coverage**.

---

## What This Project Does

This is the **backend API** for a full-featured chat application, similar to WhatsApp or Slack. It handles:

- User registration, login, and account security (JWT + 2FA)
- Real-time private and group messaging over WebSockets (Socket.IO)
- File attachments (images, PDFs, documents)
- Message history, search, pinning, editing, and deletion
- Group creation with admin-controlled membership
- Online/offline presence and typing indicators
- Token management with Redis (blacklisting, refresh, rate limiting)

The backend is designed to be connected to any frontend — React, Vue, mobile, etc. It exposes a **REST API** for standard operations and a **Socket.IO interface** for real-time events.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| HTTP Framework | Express.js |
| Real-time | Socket.IO with Redis Adapter (pub/sub) |
| Primary Database | MongoDB (via Mongoose ODM) |
| Cache & Sessions | Redis (ioredis) |
| Authentication | JWT (access + refresh tokens), bcryptjs |
| 2FA | TOTP via otplib (Google Authenticator compatible) |
| File Uploads | Multer (disk storage) |
| Input Validation | express-validator |
| Security | Helmet, CORS, xss-clean, express-mongo-sanitize, HPP, express-rate-limit |
| Logging | Winston (JSON structured logs) |
| Compression | zlib (built-in Node.js) |
| Testing | Jest, Supertest, mongodb-memory-server, socket.io-client |
| Containerization | Docker + Docker Compose |

---

## System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Client Applications                   │
│              (React / Vue / Mobile / Postman)             │
└────────────────────┬──────────────────┬──────────────────┘
                     │ HTTP REST        │ WebSocket (Socket.IO)
                     ▼                  ▼
┌──────────────────────────────────────────────────────────┐
│                    Express.js Server                      │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │               Security Middleware Layer              │ │
│  │   Helmet · CORS · Rate Limiter · XSS · Sanitize     │ │
│  └───────────────────────┬─────────────────────────────┘ │
│                          │                                │
│  ┌───────────────────────▼─────────────────────────────┐ │
│  │               Auth Middleware (JWT)                  │ │
│  └───────────────────────┬─────────────────────────────┘ │
│                          │                                │
│  ┌───────────────────────▼─────────────────────────────┐ │
│  │  Routes → Controllers → Services → Models           │ │
│  │  (auth, chat, group, health)                        │ │
│  └───────────────────────┬─────────────────────────────┘ │
│                          │                                │
│  ┌───────────────────────▼─────────────────────────────┐ │
│  │           Socket.IO Handler Layer                    │ │
│  │  (private msg · group msg · reactions · typing)     │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────┬───────────────────────────────────────────────┘
           │
    ┌──────┴──────────────────────┐
    │                             │
    ▼                             ▼
┌─────────────┐         ┌────────────────────────┐
│   MongoDB   │         │          Redis          │
│             │         │                        │
│ · users     │         │ · refresh tokens       │
│ · messages  │         │ · access token blacklist│
│ · groups    │         │ · rate limit counters  │
│             │         │ · socket.io pub/sub    │
└─────────────┘         └────────────────────────┘
```

**Request Lifecycle:**
```
Request → Helmet/CORS → Rate Limiter → JWT Auth → Validation → Controller → Service → MongoDB/Redis → JSON Response
```

---

## Key Features

### Authentication & Security
- **JWT access tokens** (15-minute expiry) + **refresh tokens** (7-day expiry) stored in Redis
- **Token blacklisting** — logged-out tokens are rejected even before expiry
- **Two-Factor Authentication (TOTP)** — compatible with Google Authenticator, Authy, etc.
- **Rate limiting** — 5 auth attempts per 15 minutes to prevent brute-force attacks
- **Password hashing** — bcrypt with automatic salting
- **Input sanitization** — all requests are sanitized against XSS, MongoDB injection, and HTTP parameter pollution

### Real-Time Messaging (Socket.IO)
- Private 1-on-1 chats using isolated room IDs
- Group chats with server-side membership validation before joining
- **Message compression** — content longer than 1000 characters is automatically compressed using zlib (deflate) and decompressed on retrieval
- **Message reactions** — like, love, laugh, sad, angry (duplicate reactions are rejected)
- **Read receipts** — per-user tracking of which messages have been seen
- **Typing indicators** — start/stop events for both private and group chats
- **Presence tracking** — `isOnline` and `lastSeen` updated on connect/disconnect

### Chat REST API
- Paginated message history (private and group)
- Full-text message search (basic and advanced with date/file type filters)
- Pin messages (for group admins)
- Edit messages (sender only)
- Soft-delete messages (sender only — messages are marked deleted, not removed)
- File uploads with MIME type and extension validation

### Group Management
- Create groups with initial member list (creator is auto-assigned as admin)
- Add / remove members (admin only)
- Promote / demote admins (admin only)
- Delete groups (admin only)

---

## Project Structure

```
chat-app-backend/
├── src/
│   ├── config/
│   │   ├── database.js        # MongoDB connection setup
│   │   ├── redis.js           # Redis client setup (ioredis)
│   │   └── socket.js          # Socket.IO server config export
│   │
│   ├── controllers/           # Request/response handlers (thin layer)
│   │   ├── authController.js
│   │   ├── chatController.js
│   │   └── groupController.js
│   │
│   ├── middleware/
│   │   ├── auth.js            # JWT verification middleware
│   │   ├── errorHandler.js    # Global error handler (AppError class)
│   │   ├── rateLimiter.js     # Rate limit configs (auth, messages)
│   │   ├── security.js        # Helmet, CORS, sanitizers
│   │   └── validation.js      # express-validator rule chains
│   │
│   ├── models/
│   │   ├── User.js            # Schema: username, email, password, 2FA, status, presence
│   │   ├── Message.js         # Schema: content, sender, recipient/group, reactions, readBy, isDeleted
│   │   └── Group.js           # Schema: name, members[], admins[]
│   │
│   ├── routes/
│   │   ├── auth.js            # /api/v1/auth/*
│   │   ├── chat.js            # /api/v1/chat/*
│   │   ├── group.js           # /api/v1/group/*
│   │   └── health.js          # /api/v1/health
│   │
│   ├── services/              # Business logic (all DB operations live here)
│   │   ├── authService.js     # register, login, logout, refreshToken, 2FA, profile
│   │   ├── chatService.js     # messages CRUD, search, pin, compression
│   │   └── fileService.js     # multer config, upload handler
│   │
│   ├── sockets/
│   │   └── socketHandlers.js  # All Socket.IO events (auth middleware + handlers)
│   │
│   ├── tests/
│   │   ├── controllers/       # Integration tests via Supertest
│   │   ├── services/          # Unit tests for business logic
│   │   ├── sockets/           # Socket.IO event tests
│   │   ├── utils/             # Utility function tests
│   │   ├── validators/        # Validator tests
│   │   └── setup.js           # Global test setup (in-memory MongoDB + Redis mock)
│   │
│   ├── utils/
│   │   ├── logger.js          # Winston logger (console + file)
│   │   ├── fileUpload.js      # Multer disk storage config (5MB limit)
│   │   └── queue.js           # BullMQ job queue (backed by Redis)
│   │
│   └── validators/
│       ├── authValidator.js   # Validation chains for auth routes
│       └── chatValidator.js   # Validation chains for chat routes
│
├── uploads/                   # Uploaded files (served statically at /uploads)
├── logs/                      # Winston log output files
├── server.js                  # Application entry point
├── jest.config.js             # Jest configuration
├── .env.test                  # Environment config for tests (no real DB needed)
├── docker-compose.yml         # Multi-service Docker setup
└── Dockerfile
```

---

## Getting Started

### Prerequisites
- Node.js >= 16
- MongoDB 6+
- Redis 7+

### 1. Clone and Install
```bash
git clone https://github.com/rashid-mamun/chat-app-backend.git
cd chat-app-backend
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# Server
NODE_ENV=development
PORT=5000
API_VERSION=v1

# MongoDB
MONGO_URI=mongodb://localhost:27017/chat-app

# Redis
REDIS_URL=redis://localhost:6379

# JWT — use long, random strings (min 32 characters)
JWT_SECRET=your_access_token_secret_here
JWT_REFRESH_SECRET=your_refresh_token_secret_here
JWT_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d

# CORS — comma-separated allowed frontend origins
ALLOWED_ORIGINS=http://localhost:3000
```

### 3. Start Services and Run

```bash
# Option A — Docker (starts app + MongoDB + Redis together)
docker-compose up --build

# Option B — Local development
mongod                 # start MongoDB
redis-server           # start Redis
npm run dev            # start app with auto-restart (nodemon)

# Production
npm start
```

### 4. Verify the Server is Running
```bash
curl http://localhost:5000/api/v1/health
# Should return: { "status": "healthy", ... }
```

---

## API Overview

> Full Postman collection included: `Chat-App-Backend.postman_collection.json`
> Import it into Postman — the **Register** and **Login** requests automatically save tokens.

Base URL: `http://localhost:5000/api/v1`

🔒 = Requires `Authorization: Bearer <access_token>` header

### Authentication `/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | — | Register new user (returns tokens) |
| POST | `/auth/login` | — | Login (returns tokens; supports 2FA) |
| POST | `/auth/logout` | 🔒 | Invalidate token and clear session |
| POST | `/auth/refresh-token` | — | Get new access token via refresh token |
| POST | `/auth/2fa/setup` | 🔒 | Initiate 2FA (returns TOTP secret + QR URI) |
| POST | `/auth/2fa/verify` | 🔒 | Verify TOTP code and enable 2FA |
| GET | `/auth/profile` | 🔒 | Get current user profile |
| PUT | `/auth/profile` | 🔒 | Update username or avatar |
| PUT | `/auth/change-password` | 🔒 | Change password (invalidates all sessions) |

### Chat `/chat`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/chat/private/:recipientId` | 🔒 | Get paginated private messages (`?page=1&limit=20`) |
| GET | `/chat/group/:groupId` | 🔒 | Get paginated group messages |
| GET | `/chat/user` | 🔒 | Get all chats for current user |
| GET | `/chat/messages/search` | 🔒 | Search messages by keyword |
| GET | `/chat/messages/search/advanced` | 🔒 | Search with date range and file type filters |
| POST | `/chat/messages/:messageId/pin` | 🔒 | Pin a message |
| PUT | `/chat/messages/:messageId` | 🔒 | Edit a message (sender only) |
| DELETE | `/chat/messages/:messageId` | 🔒 | Soft-delete a message (sender only) |
| POST | `/chat/upload` | 🔒 | Upload a file (multipart/form-data, field: `file`) |

### Groups `/group`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/group` | 🔒 | Create group (creator becomes admin) |
| GET | `/group` | 🔒 | List all groups the user belongs to |
| GET | `/group/:groupId` | 🔒 | Get group details |
| PUT | `/group/:groupId` | 🔒 Admin | Update group name/settings |
| DELETE | `/group/:groupId` | 🔒 Admin | Delete group |
| POST | `/group/:groupId/members` | 🔒 Admin | Add member `{ "memberId": "..." }` |
| DELETE | `/group/:groupId/members/:memberId` | 🔒 Admin | Remove member |
| POST | `/group/:groupId/admins` | 🔒 Admin | Promote member to admin `{ "adminId": "..." }` |
| DELETE | `/group/:groupId/admins/:adminId` | 🔒 Admin | Demote admin |

### Health `/health`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | — | Returns server status, MongoDB & Redis connectivity, uptime |

---

## Socket.IO Events

Connect with:
```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: { token: '<your_access_token>' }
});
```

### Events You Send (Client → Server)

| Event | Payload | Description |
|-------|---------|-------------|
| `joinPrivateChat` | `{ recipientId }` | Join the private chat room with a user |
| `joinGroupChat` | `{ groupId }` | Join a group chat room (membership validated) |
| `sendPrivateMessage` | `{ recipientId, content }` | Send a private message |
| `sendGroupMessage` | `{ groupId, content }` | Send a message to a group |
| `markMessageAsRead` | `{ messageId }` | Mark a message as read |
| `addReaction` | `{ messageId, reaction }` | React to a message (`like` `love` `laugh` `sad` `angry`) |
| `typing` | `{ chatType, recipientId?, groupId? }` | Notify others you are typing |
| `stopTyping` | `{ chatType, recipientId?, groupId? }` | Notify others you stopped typing |

### Events You Receive (Server → Client)

| Event | Payload | Description |
|-------|---------|-------------|
| `joinedPrivateChat` | `{ room, recipientId }` | Confirmed room join |
| `joinedGroupChat` | `{ groupId }` | Confirmed group room join |
| `newPrivateMessage` | Message object | A new private message arrived |
| `newGroupMessage` | Message object | A new group message arrived |
| `messageRead` | `{ messageId, readBy }` | Your message was read |
| `messageReactionAdded` | `{ messageId, reaction, userId, username }` | Reaction added to a message |
| `userTyping` | `{ userId, username }` | Someone is typing |
| `userStoppedTyping` | `{ userId }` | Someone stopped typing |
| `error` | `{ message }` | Server-side socket error |

---

## Running Tests

Tests run entirely in memory — **no real MongoDB or Redis required**.

```bash
# Run all 163 tests
npm test

# With coverage report
npm test -- --coverage

# Single file
npx jest src/tests/controllers/authController.test.js --no-coverage
```

### Test Results

```
Test Suites: 11 passed, 11 total
Tests:       163 passed, 163 total
Coverage:    83%+ overall
```

| Area | Statement Coverage | Function Coverage |
|------|--------------------|-------------------|
| Controllers | 96.28% | 100% |
| Services | 87.19% | 100% |
| Socket Handlers | 84.45% | 100% |
| Models | 93.87% | 81.81% |
| Validators | 100% | 100% |

---

## Error Response Format

All API errors follow a consistent structure:

```json
{
  "status": "fail",
  "message": "Descriptive error message here"
}
```

Common HTTP status codes used:
- `400` — Bad request / validation error
- `401` — Unauthenticated (no token or invalid token)
- `403` — Forbidden (authenticated but not authorized)
- `404` — Resource not found
- `429` — Rate limit exceeded
- `500` — Internal server error

---

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
