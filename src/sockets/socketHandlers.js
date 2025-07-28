const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const User = require('../models/User');
const Group = require('../models/Group');
const { createAdapter } = require('@socket.io/redis-adapter');
const { redisClient } = require('../config/redis');
const logger = require('../utils/logger');
const zlib = require('zlib');
const util = require('util');
const compress = util.promisify(zlib.deflate);
const decompress = util.promisify(zlib.inflate);

const setupSocket = async (io) => {
    const pubClient = redisClient.duplicate();
    const subClient = redisClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));

    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Authentication error: No token provided'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id);

            if (!user || user.status !== 'active') {
                return next(new Error('Authentication error: Invalid user'));
            }

            socket.user = user;
            socket.userId = user._id.toString();
            next();
        } catch (error) {
            logger.error('Socket authentication error:', error);
            next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', async (socket) => {
        try {
            logger.info(`User connected: ${socket.user.username} (${socket.userId})`);

            await User.findByIdAndUpdate(socket.userId, {
                isOnline: true,
                lastSeen: new Date()
            });

            socket.join(`user:${socket.userId}`);

            socket.on('joinPrivateChat', async (data) => {
                try {
                    const { recipientId } = data;
                    if (!recipientId) {
                        socket.emit('error', { message: 'Recipient ID is required' });
                        return;
                    }

                    const room = [socket.userId, recipientId].sort().join('-');
                    socket.join(room);

                    logger.info(`User ${socket.userId} joined private chat with ${recipientId}`);
                    socket.emit('joinedPrivateChat', { room, recipientId });
                } catch (error) {
                    logger.error('Error joining private chat:', error);
                    socket.emit('error', { message: 'Failed to join private chat' });
                }
            });

            socket.on('joinGroupChat', async (data) => {
                try {
                    const { groupId } = data;
                    if (!groupId) {
                        socket.emit('error', { message: 'Group ID is required' });
                        return;
                    }

                    const group = await Group.findById(groupId);
                    if (!group || !group.members.includes(socket.userId)) {
                        socket.emit('error', { message: 'Access denied to group' });
                        return;
                    }

                    socket.join(`group:${groupId}`);
                    logger.info(`User ${socket.userId} joined group ${groupId}`);
                    socket.emit('joinedGroupChat', { groupId });
                } catch (error) {
                    logger.error('Error joining group chat:', error);
                    socket.emit('error', { message: 'Failed to join group chat' });
                }
            });

            socket.on('sendPrivateMessage', async (data) => {
                try {
                    let { recipientId, content } = data;

                    if (!recipientId || !content?.trim()) {
                        socket.emit('error', { message: 'Recipient ID and content are required' });
                        return;
                    }

                    if (content.length > 1000) {
                        content = (await compress(Buffer.from(content))).toString('base64');
                    }

                    const message = new Message({
                        sender: socket.userId,
                        recipient: recipientId,
                        content: content.trim(),
                        chatType: 'private',
                        isCompressed: content.length > 1000
                    });

                    await message.save();
                    await message.populate('sender', 'username avatar');

                    const room = [socket.userId, recipientId].sort().join('-');
                    io.to(room).emit('newPrivateMessage', message);

                    logger.info(`Private message sent from ${socket.userId} to ${recipientId}`);
                } catch (error) {
                    logger.error('Error sending private message:', error);
                    socket.emit('error', { message: 'Failed to send message' });
                }
            });

            socket.on('sendGroupMessage', async (data) => {
                try {
                    let { groupId, content } = data;

                    if (!groupId || !content?.trim()) {
                        socket.emit('error', { message: 'Group ID and content are required' });
                        return;
                    }

                    if (content.length > 1000) {
                        content = (await compress(Buffer.from(content))).toString('base64');
                    }

                    const message = new Message({
                        sender: socket.userId,
                        group: groupId,
                        content: content.trim(),
                        chatType: 'group',
                        isCompressed: content.length > 1000
                    });

                    await message.save();
                    await message.populate('sender', 'username avatar');

                    io.to(`group:${groupId}`).emit('newGroupMessage', message);

                    logger.info(`Group message sent from ${socket.userId} to group ${groupId}`);
                } catch (error) {
                    logger.error('Error sending group message:', error);
                    socket.emit('error', { message: 'Failed to send message' });
                }
            });

            socket.on('markMessageAsRead', async (data) => {
                try {
                    const { messageId } = data;
                    const message = await Message.findById(messageId);

                    if (message) {
                        await message.markAsRead(socket.userId);

                        const targetRoom = message.chatType === 'private'
                            ? `user:${message.sender}`
                            : `group:${message.group}`;

                        io.to(targetRoom).emit('messageRead', {
                            messageId,
                            readBy: socket.userId
                        });
                    }
                } catch (error) {
                    logger.error('Error marking message as read:', error);
                }
            });

            socket.on('addReaction', async (data) => {
                try {
                    const { messageId, reaction } = data;
                    if (!messageId || !['like', 'love', 'laugh', 'sad', 'angry'].includes(reaction)) {
                        socket.emit('error', { message: 'Invalid message ID or reaction' });
                        return;
                    }

                    const message = await Message.findById(messageId);
                    if (!message || message.isDeleted) {
                        socket.emit('error', { message: 'Message not found' });
                        return;
                    }

                    const existingReaction = message.reactions.find(r =>
                        r.user.toString() === socket.userId && r.reaction === reaction
                    );
                    if (existingReaction) {
                        socket.emit('error', { message: 'Reaction already exists' });
                        return;
                    }

                    message.reactions.push({ user: socket.userId, reaction });
                    await message.save();

                    const targetRoom = message.chatType === 'private'
                        ? [message.sender.toString(), message.recipient.toString()].sort().join('-')
                        : `group:${message.group}`;

                    io.to(targetRoom).emit('messageReactionAdded', {
                        messageId,
                        reaction,
                        userId: socket.userId,
                        username: socket.user.username
                    });

                    logger.info(`Reaction ${reaction} added to message ${messageId} by ${socket.userId}`);
                } catch (error) {
                    logger.error('Error adding reaction:', error);
                    socket.emit('error', { message: 'Failed to add reaction' });
                }
            });

            socket.on('typing', (data) => {
                const { chatType, recipientId, groupId } = data;

                if (chatType === 'private' && recipientId) {
                    socket.to(`user:${recipientId}`).emit('userTyping', {
                        userId: socket.userId,
                        username: socket.user.username
                    });
                } else if (chatType === 'group' && groupId) {
                    socket.to(`group:${groupId}`).emit('userTyping', {
                        userId: socket.userId,
                        username: socket.user.username
                    });
                }
            });

            socket.on('stopTyping', (data) => {
                const { chatType, recipientId, groupId } = data;

                if (chatType === 'private' && recipientId) {
                    socket.to(`user:${recipientId}`).emit('userStoppedTyping', {
                        userId: socket.userId
                    });
                } else if (chatType === 'group' && groupId) {
                    socket.to(`group:${groupId}`).emit('userStoppedTyping', {
                        userId: socket.userId
                    });
                }
            });

            socket.on('disconnect', async () => {
                try {
                    await User.findByIdAndUpdate(socket.userId, {
                        isOnline: false,
                        lastSeen: new Date()
                    });

                    logger.info(`User disconnected: ${socket.user.username} (${socket.userId})`);
                } catch (error) {
                    logger.error('Error handling disconnect:', error);
                }
            });
        } catch (error) {
            logger.error('Socket connection error:', error);
            socket.disconnect();
        }
    });
};

module.exports = setupSocket;
