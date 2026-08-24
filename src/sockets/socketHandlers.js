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
        try {
            if (!redisClient.isMemory) {
                const pubClient = redisClient.duplicate();
                const subClient = redisClient.duplicate();
                await Promise.all([pubClient.connect(), subClient.connect()]);
                io.adapter(createAdapter(pubClient, subClient));
                logger.info('Socket.IO Redis adapter configured');
            }
        } catch (err) {
            logger.warn('Socket.IO Redis adapter initialization failed, falling back to in-memory adapter: ' + err.message);
        }
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

            // Do not block listener registration on a presence write. Clients can
            // emit room-join events immediately after their `connect` event.
            User.findByIdAndUpdate(socket.userId, {
                isOnline: true,
                lastSeen: new Date()
            }).catch((error) => logger.warn(`Failed to update online status: ${error.message}`));

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
                    logger.debug(`User ${socket.userId} joined private chat with ${recipientId}`);
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
                    logger.debug(`User ${socket.userId} joined group chat ${groupId}`);
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
                        socket.emit('error', { message: 'Recipient ID and content are required' });
                        return;
                    }

                    // Check if either user has blocked the other
                    const recipient = await User.findById(recipientId);
                    if (!recipient) {
                        socket.emit('error', { message: 'Recipient not found' });
                        return;
                    }

                    if (recipient.blockedUsers.includes(socket.userId) || socket.user.blockedUsers.includes(recipientId)) {
                        socket.emit('error', { message: 'Cannot send message to this user' });
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
                    io.to(room).emit('newPrivateMessage', message);
                    io.to(`user:${recipientId}`).emit('newPrivateMessage', message);
                    io.to(`user:${socket.userId}`).emit('newPrivateMessage', message);

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

                    const group = await Group.findById(groupId);
                    if (!group || !group.members.some(m => m.toString() === socket.userId)) {
                        socket.emit('error', { message: 'Access denied to group' });
                        return;
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

                    const VALID_REACTIONS = ['like', 'love', 'haha', 'wow', 'sad', 'angry', '👍', '❤️', '😂', '😮', '😢', '🔥'];

                    if (!VALID_REACTIONS.includes(reaction)) {
                        return socket.emit('error', { message: 'Invalid message ID or reaction' });
                    }

                    const message = await Message.findById(messageId);
                    if (!message || message.isDeleted) {
                        return socket.emit('error', { message: 'Message not found' });
                    }

                    const existingIdx = message.reactions.findIndex(
                        (r) => r.user.toString() === socket.userId
                    );

                    if (existingIdx > -1) {
                        if (message.reactions[existingIdx].reaction === reaction) {
                            return socket.emit('error', { message: 'Reaction already exists' });
                        } else {
                            message.reactions[existingIdx].reaction = reaction;
                        }
                    } else {
                        message.reactions.push({ user: socket.userId, reaction });
                    }

                    await message.save();

                    const reactionPayload = {
                        messageId: message._id.toString(),
                        reaction,
                        userId: socket.userId,
                        username: (await User.findById(socket.userId))?.username
                    };

                    socket.emit('messageReactionAdded', reactionPayload);

                    const fullPayload = {
                        messageId: message._id.toString(),
                        reactions: message.reactions
                    };

                    if (message.chatType === 'private') {
                        const room = [socket.userId, message.recipient.toString()].sort().join('-');
                        io.to(room).emit('messageReactionUpdated', fullPayload);
                        io.to(`user:${message.sender.toString()}`).emit('messageReactionUpdated', fullPayload);
                        io.to(`user:${message.recipient.toString()}`).emit('messageReactionUpdated', fullPayload);
                    } else if (message.chatType === 'group') {
                        io.to(`group:${message.group}`).emit('messageReactionUpdated', fullPayload);
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
                        userId: socket.userId,
                        username: socket.user.username
                    });
                } else if (chatType === 'group' && groupId) {
                    socket.to(`group:${groupId}`).emit('userStoppedTyping', {
                        userId: socket.userId,
                        username: socket.user.username
                    });
                }
            });

            socket.on('groupAction', (data) => {
                try {
                    const { type, groupId, targetUserId, details } = data;
                    if (type === 'invite' && targetUserId) {
                        io.to(`user:${targetUserId}`).emit('newGroupInvite', {
                            groupId,
                            details
                        });
                    } else if (type === 'joinRequest' && groupId) {
                        io.to(`group:${groupId}`).emit('newJoinRequest', {
                            groupId,
                            userId: socket.userId,
                            details
                        });
                    } else if (type === 'memberUpdate' && groupId) {
                        io.to(`group:${groupId}`).emit('groupMemberUpdate', {
                            groupId,
                            userId: targetUserId || socket.userId,
                            details
                        });
                    }
                } catch (error) {
                    logger.error('Error in groupAction:', error);
                }
            });

            socket.on('disconnect', async () => {
                try {
                    logger.info(`User disconnected: ${socket.user?.username} (${socket.userId})`);

                    await User.findByIdAndUpdate(socket.userId, {
                        isOnline: false,
                        lastSeen: new Date()
                    });

                    socket.broadcast.emit('userStatusChanged', {
                        userId: socket.userId,
                        isOnline: false
                    });
                } catch (error) {
                    logger.error('Error handling socket disconnect:', error);
                }
            });
        } catch (error) {
            logger.error('Socket connection error:', error);
        }
    });
};

module.exports = setupSocket;
