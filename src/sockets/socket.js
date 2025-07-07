const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

const setupSocket = async (io) => {
    // Initialize Redis clients
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);

    // Set up Redis adapter for Socket.IO
    io.adapter(createAdapter(pubClient, subClient));

    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error('Authentication error'));

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.user = decoded;
            next();
        } catch (error) {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.user.username}`);

        // Join private chat room
        socket.on('joinPrivate', (recipientId) => {
            const room = [socket.user.id, recipientId].sort().join('-');
            socket.join(room);
        });

        // Join group chat room
        socket.on('joinGroup', (groupId) => {
            socket.join(`group-${groupId}`);
        });

        // Send private message
        socket.on('privateMessage', async ({ recipientId, content }) => {
            const room = [socket.user.id, recipientId].sort().join('-');
            const message = new Message({
                sender: socket.user.id,
                recipient: recipientId,
                content,
                chatType: 'private',
            });
            await message.save();
            io.to(room).emit('privateMessage', message);
        });

        // Send group message
        socket.on('groupMessage', async ({ groupId, content }) => {
            const message = new Message({
                sender: socket.user.id,
                group: groupId,
                content,
                chatType: 'group',
            });
            await message.save();
            io.to(`group-${groupId}`).emit('groupMessage', message);
        });

        // Handle file sharing
        socket.on('fileMessage', async ({ recipientId, groupId, fileUrl, fileType }) => {
            const message = new Message({
                sender: socket.user.id,
                fileUrl,
                fileType,
                chatType: recipientId ? 'private' : 'group',
                recipient: recipientId || null,
                group: groupId || null,
            });
            await message.save();
            if (recipientId) {
                const room = [socket.user.id, recipientId].sort().join('-');
                io.to(room).emit('privateMessage', message);
            } else {
                io.to(`group-${groupId}`).emit('groupMessage', message);
            }
        });

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.user.username}`);
        });
    });
};

module.exports = setupSocket;