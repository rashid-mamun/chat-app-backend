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
    if (process.env.NODE_ENV !== 'test') {
        const pubClient = redisClient.duplicate();
        const subClient = redisClient.duplicate();
        await Promise.all([pubClient.connect(), subClient.connect()]);
        io.adapter(createAdapter(pubClient, subClient));
    }

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

            // Broadcast online status
            socket.broadcast.emit('userStatusChanged', {
                userId: socket.userId,
                isOnline: true
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
                    console.log(`User ${socket.userId} joined private room: ${room} (recipient: ${recipientId})`);

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
                    if (!group || !group.members.some(m => m.toString() === socket.userId)) {
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
                    const { recipientId, content, fileUrl, fileName, fileType, fileSize, replyTo, isForwarded } = data;

                    if (!recipientId || (!content?.trim() && !fileUrl)) {
                        socket.emit('error', { message: 'Recipient ID and content/file are required' });
                        return;
                    }

                    const originalPrivateLength = content?.length || 0;
                    let processedContent = content?.trim() || '';
                    if (originalPrivateLength > 1000) {
                        processedContent = (await compress(Buffer.from(processedContent))).toString('base64');
                    }

                    const message = new Message({
                        sender: socket.userId,
                        recipient: recipientId,
                        content: processedContent,
                        fileUrl,
                        fileName,
                        fileType,
                        fileSize,
                        chatType: 'private',
                        isCompressed: originalPrivateLength > 1000,
                        replyTo,
                        isForwarded
                    });

                    await message.save();
                    await message.populate([
                        { path: 'sender', select: 'username avatar' },
                        { path: 'replyTo', populate: { path: 'sender', select: 'username' } }
                    ]);

                    // Decompress reply content if needed
                    if (message.replyTo && message.replyTo.isCompressed) {
                        try {
                            const decompressed = await decompress(Buffer.from(message.replyTo.content, 'base64'));
                            message.replyTo.content = decompressed.toString();
                        } catch (err) {
                            logger.error('Reply content decompression error:', err);
                        }
                    }

                    const room = [socket.userId, recipientId].sort().join('-');
                    console.log(`Sending private message from ${socket.userId} in room: ${room}`);
                    io.to(room).emit('newPrivateMessage', message);

                    logger.info(`Private message sent from ${socket.userId} to ${recipientId} in room ${room}`);
                } catch (error) {
                    logger.error('Error sending private message:', error);
                    socket.emit('error', { message: 'Failed to send message' });
                }
            });

            socket.on('sendGroupMessage', async (data) => {
                try {
                    const { groupId, content, fileUrl, fileName, fileType, fileSize, replyTo, isForwarded } = data;

                    if (!groupId || (!content?.trim() && !fileUrl)) {
                        socket.emit('error', { message: 'Group ID and content/file are required' });
                        return;
                    }

                    const originalGroupLength = content?.length || 0;
                    let processedContent = content?.trim() || '';
                    if (originalGroupLength > 1000) {
                        processedContent = (await compress(Buffer.from(processedContent))).toString('base64');
                    }

                    const message = new Message({
                        sender: socket.userId,
                        group: groupId,
                        content: processedContent,
                        fileUrl,
                        fileName,
                        fileType,
                        fileSize,
                        chatType: 'group',
                        isCompressed: originalGroupLength > 1000,
                        replyTo,
                        isForwarded
                    });

                    await message.save();
                    await message.populate([
                        { path: 'sender', select: 'username avatar' },
                        { path: 'replyTo', populate: { path: 'sender', select: 'username' } }
                    ]);

                    // Decompress reply content if needed
                    if (message.replyTo && message.replyTo.isCompressed) {
                        try {
                            const decompressed = await decompress(Buffer.from(message.replyTo.content, 'base64'));
                            message.replyTo.content = decompressed.toString();
                        } catch (err) {
                            logger.error('Reply content decompression error:', err);
                        }
                    }

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
                    if (!messageId || !reaction) return;

                    const message = await Message.findById(messageId);
                    if (!message || message.isDeleted) return;

                    // Prevent reacting to own message
                    if (message.sender.toString() === socket.userId) {
                        return socket.emit('error', { message: 'Cannot react to your own message' });
                    }

                    const existingIdx = message.reactions.findIndex(
                        (r) => r.user.toString() === socket.userId
                    );

                    if (existingIdx > -1) {
                        if (message.reactions[existingIdx].reaction === reaction) {
                            message.reactions.splice(existingIdx, 1); // Toggle off
                        } else {
                            message.reactions[existingIdx].reaction = reaction; // Change
                        }
                    } else {
                        message.reactions.push({ user: socket.userId, reaction }); // Add new
                    }

                    await message.save();

                    const payload = {
                        messageId: message._id,
                        reactions: message.reactions
                    };

                    // Emit to the reactor directly (they may not be in the private room)
                    socket.emit('messageReactionUpdated', payload);

                    // Emit to the message sender (via their personal room)
                    const senderId = message.sender.toString();
                    if (senderId !== socket.userId) {
                        io.to(`user:${senderId}`).emit('messageReactionUpdated', payload);
                    }

                    // For private chat: also emit to recipient's personal room
                    if (message.chatType === 'private') {
                        const recipientId = message.recipient.toString();
                        if (recipientId !== socket.userId) {
                            io.to(`user:${recipientId}`).emit('messageReactionUpdated', payload);
                        }
                    }

                    // Also emit to the chat room for any other listeners (e.g. group)
                    if (message.chatType === 'group') {
                        io.to(`group:${message.group}`).emit('messageReactionUpdated', payload);
                    }

                    logger.info(`Reaction ${reaction} on message ${messageId} by ${socket.userId}`);
                } catch (error) {
                    logger.error('Error adding reaction:', error);
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

                    // Broadcast offline status
                    socket.broadcast.emit('userStatusChanged', {
                        userId: socket.userId,
                        isOnline: false
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
