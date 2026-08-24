const express = require('express');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const http = require('http');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const path = require('path');
const logger = require('./src/utils/logger');
const connectDB = require('./src/config/database');
const { connectRedis } = require('./src/config/redis');
const setupSocket = require('./src/sockets/socketHandlers');
const securityMiddleware = require('./src/middleware/security');
const errorHandler = require('./src/middleware/errorHandler');
const authRoutes = require('./src/routes/auth');
const chatRoutes = require('./src/routes/chat');
const groupRoutes = require('./src/routes/group');
const userRoutes = require('./src/routes/user');
const uploadRoutes = require('./src/routes/upload');
const healthRoutes = require('./src/routes/health');
const validateEnvironment = require('./src/config/env');
const { initializeQueue, closeQueue } = require('./src/services/queueService');

dotenv.config();
validateEnvironment();

const app = express();
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173')
            .split(',')
            .map((origin) => origin.trim()),
        credentials: true
    }
});
app.locals.io = io;

app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
securityMiddleware(app);

// Render disks should set UPLOAD_PATH=/var/data/uploads.
const uploadPath = path.resolve(process.env.UPLOAD_PATH || path.join(__dirname, 'uploads'));
require('fs').mkdirSync(uploadPath, { recursive: true });
app.use('/uploads', express.static(uploadPath, {
    dotfiles: 'deny',
    fallthrough: false,
    setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Disposition', 'attachment');
    }
}));

// Routes
app.get('/', (req, res) => {
    const apiVersion = process.env.API_VERSION || 'v1';

    res.status(200).json({
        name: 'ChatApp API',
        status: 'running',
        version: apiVersion,
        health: `/api/${apiVersion}/health`
    });
});

app.use(`/api/${process.env.API_VERSION || 'v1'}/auth`, authRoutes);
app.use(`/api/${process.env.API_VERSION || 'v1'}/chat`, chatRoutes);
app.use(`/api/${process.env.API_VERSION || 'v1'}/group`, groupRoutes);
app.use(`/api/${process.env.API_VERSION || 'v1'}/users`, userRoutes);
app.use(`/api/${process.env.API_VERSION || 'v1'}/upload`, uploadRoutes);
app.use(`/api/${process.env.API_VERSION || 'v1'}`, healthRoutes);

app.use(errorHandler);

const startServer = async () => {
    try {
        await connectDB();
        await connectRedis();
        await initializeQueue();
        await setupSocket(io);

        const PORT = process.env.PORT || 5000;
        server.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`);
        });
    } catch (error) {
        logger.error('Server startup failed:', error);
        process.exit(1);
    }
};

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
    startServer();
}

const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down`);
    await closeQueue();
    server.close(() => process.exit(0));
};

if (process.env.NODE_ENV !== 'test') {
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;
