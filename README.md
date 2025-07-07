# Real-Time Chat Application Backend

A robust, scalable backend for a real-time chat application supporting private messaging, group chats, file sharing, and emoji support. Built with Node.js, Express, Socket.IO, MongoDB, Redis, BullMQ, and Docker, this project is designed for developers seeking a modern, containerized chat solution.


## Features
- **User Authentication**: Secure registration and login with JWT-based authentication.
- **Private Messaging**: Real-time one-on-one chats with text and emoji support.
- **Group Chats**: Create and manage group conversations with multiple users.
- **File Sharing**: Upload and share files (images, PDFs, etc.) with asynchronous processing via BullMQ.
- **Real-Time Communication**: Powered by Socket.IO with Redis adapter for scalability across multiple instances.
- **Containerized Deployment**: Fully Dockerized with MongoDB and Redis for consistent environments.
- **Emoji Support**: Seamless handling of Unicode emojis in messages.

## Tech Stack
- **Node.js & Express**: RESTful API framework.
- **Socket.IO**: Real-time messaging with Redis adapter for scalability.
- **MongoDB**: NoSQL database for storing users, messages, and groups.
- **Redis**: Used for Socket.IO scaling and BullMQ job queues.
- **BullMQ**: Asynchronous task processing for file uploads.
- **Multer**: File upload handling with local storage.
- **JWT**: Secure user authentication.
- **Docker**: Containerization for app, MongoDB, and Redis.

## Prerequisites
- **Node.js**: Version 18 or higher.
- **Docker**: Docker Desktop or CLI for containerized setup.
- **Postman**: For testing API endpoints (optional for WebSocket testing).
- **MongoDB & Redis**: Local instances or via Docker.
- **Git**: For cloning the repository.

## Project Setup
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/rashid-mamun/chat-app-backend.git
   cd chat-app-backend
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the project root:
   ```env
   PORT=5000
   MONGO_URI=mongodb://mongo:27017/chat-app
   JWT_SECRET=your_jwt_secret_key
   REDIS_URL=redis://redis:6379
   ```
   Replace `your_jwt_secret_key` with a secure key (e.g., generated via `openssl rand -base64 32`).

4. **Create Uploads Directory**:
   ```bash
   mkdir uploads
   ```

## Running the Application
### Option 1: Locally (Without Docker)
1. **Start MongoDB and Redis**:
   - MongoDB: Run `mongod` (default port: 27017).
   - Redis: Run `redis-server` (default port: 6379).
2. **Update `.env`**:
   - If not using Docker, set `MONGO_URI=mongodb://localhost:27017/chat-app` and `REDIS_URL=redis://localhost:6379`.
3. **Start the Server**:
   ```bash
   npm start
   ```
   - The app runs on `http://localhost:5000`.

### Option 2: With Docker
1. **Build and Run Containers**:
   ```bash
   docker-compose up --build
   ```
2. **Access Services**:
   - API: `http://localhost:5000`
   - MongoDB: `localhost:27017`
   - Redis: `localhost:6379`
3. **Stop Containers**:
   ```bash
   docker-compose down
   ```

## API Endpoints
All endpoints except `/api/auth/*` require a `Bearer <token>` in the `Authorization` header.

| Method | Endpoint                     | Description                          | Body Example                                                                 |
|--------|------------------------------|--------------------------------------|------------------------------------------------------------------------------|
| POST   | `/api/auth/register`         | Register a new user                  | `{"username": "testuser", "email": "test@example.com", "password": "password123"}` |
| POST   | `/api/auth/login`            | Login and get JWT token              | `{"email": "test@example.com", "password": "password123"}`                    |
| POST   | `/api/chat/private`          | Send a private message               | `{"recipientId": "<user_id>", "content": "Hello 😊"}`                         |
| POST   | `/api/chat/group`            | Send a group message                 | `{"groupId": "<group_id>", "content": "Group message 😊"}`                    |
| POST   | `/api/chat/file`             | Upload a file                        | Form-data: `file` (file), `chatType` ("private" or "group"), `recipientId` or `groupId` |
| POST   | `/api/chat/group/create`     | Create a group                       | `{"name": "Test Group", "memberIds": ["<user_id>"]}`                         |
| GET    | `/api/chat/chats`            | Get user's private and group chats   | None                                                                         |

## WebSocket Events
Connect to `ws://localhost:5000` with the JWT token in `auth.token`.

| Event            | Description                          | Payload Example                                              |
|-------------------|--------------------------------------|-------------------------------------------------------------|
| `joinPrivate`     | Join a private chat room            | `recipientId: "<user_id>"`                                  |
| `joinGroup`       | Join a group chat room              | `groupId: "<group_id>"`                                     |
| `privateMessage`  | Send a private message              | `{"recipientId": "<user_id>", "content": "Hello 😊"}`        |
| `groupMessage`    | Send a group message                | `{"groupId": "<group_id>", "content": "Group message 😊"}`   |
| `fileMessage`     | Notify file upload                  | `{"recipientId": "<user_id>", "groupId": "<group_id>", "fileUrl": "/uploads/file.jpg", "fileType": "image/jpeg"}` |
| `privateMessage`  | Receive private message (response)   | Message object                                              |
| `groupMessage`    | Receive group message (response)     | Message object                                              |

## Testing
### Using Postman
1. **Import the Postman Collection**:
   - Save `ChatAppBackend.postman_collection.json` from the project root.
   - Import it into Postman.
2. **Set Up Environment**:
   - Create a Postman environment with variables:
     - `baseUrl`: `http://localhost:5000`
     - `token`: Set after login
     - `userId`: Set after login
     - `recipientId`: Set after registering a second user
     - `groupId`: Set after creating a group
3. **Run Requests**:
   - Register two users (set `recipientId` for the second user).
   - Login to obtain `token` and `userId`.
   - Test private messages, group creation, group messages, file uploads, and chat retrieval.
   - For file uploads, select a file (e.g., `test.jpg`) in the form-data body.

### Using WebSocket Client
1. **Connect to Socket.IO**:
   - Use Postman’s WebSocket feature or a library like `socket.io-client`.
   - Endpoint: `ws://localhost:5000`
   - Pass JWT token in `auth.token`.
2. **Test Events**:
   - Emit `joinPrivate` and `privateMessage` for private chats.
   - Emit `joinGroup` and `groupMessage` for group chats.
   - Listen for `privateMessage` and `groupMessage` events to verify real-time messaging.

