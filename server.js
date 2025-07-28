const express = require('express');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const http = require('http');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
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
const healthRoutes = require('./src/routes/health');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        credentials: true
    }
});
app.locals.io = io;

app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
securityMiddleware(app);

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use(`/api/${process.env.API_VERSION || 'v1'}/auth`, authRoutes);
app.use(`/api/${process.env.API_VERSION || 'v1'}/chat`, chatRoutes);
app.use(`/api/${process.env.API_VERSION || 'v1'}/group`, groupRoutes);
app.use(`/api/${process.env.API_VERSION || 'v1'}`, healthRoutes);

app.use(errorHandler);

const startServer = async () => {
    try {
        await connectDB();
        await connectRedis();
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

module.exports = app;