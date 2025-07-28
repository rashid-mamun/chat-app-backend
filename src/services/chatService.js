const mongoose = require('mongoose');
const Message = require('../models/Message');
const Group = require('../models/Group');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const zlib = require('zlib');
const { promisify } = require('util');

const compress = promisify(zlib.deflate);
const decompress = promisify(zlib.inflate);

const getPrivateMessages = async (userId, recipientId, page = 1, limit = 20) => {
    try {
        const skip = (page - 1) * limit;
        const messages = await Message.find({
            $or: [
                { sender: userId, recipient: recipientId, chatType: 'private' },
                { sender: recipientId, recipient: userId, chatType: 'private' }
            ]
        })
            .populate('sender', 'username')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const decompressedMessages = await Promise.all(messages.map(async (msg) => {
            if (msg.isCompressed) {
                try {
                    msg.content = (await decompress(Buffer.from(msg.content, 'base64'))).toString();
                } catch (error) {
                    logger.error('Decompression error:', error);
                }
            }
            return msg;
        }));

        return decompressedMessages;
    } catch (error) {
        logger.error('Error fetching private messages:', error);
        throw new AppError('Failed to fetch private messages', 500);
    }
};

const getGroupMessages = async (groupId, userId, page = 1, limit = 20) => {
    try {
        const group = await Group.findById(groupId).lean();
        if (!group || !group.members.map(id => id.toString()).includes(userId.toString())) {
            throw new AppError('Access denied to group', 403);
        }

        const skip = (page - 1) * limit;
        const messages = await Message.find({ group: groupId, chatType: 'group' })
            .populate('sender', 'username')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const decompressedMessages = await Promise.all(messages.map(async (msg) => {
            if (msg.isCompressed) {
                try {
                    msg.content = (await decompress(Buffer.from(msg.content, 'base64'))).toString();
                } catch (error) {
                    logger.error('Decompression error:', error);
                }
            }
            return msg;
        }));

        return decompressedMessages;
    } catch (error) {
        logger.error('Error fetching group messages:', error);
        throw new AppError(error.message || 'Failed to fetch group messages', error.statusCode || 500);
    }
};

const getUserChats = async (userId) => {
    try {
        const privateMessages = await Message.find({
            $or: [{ sender: userId }, { recipient: userId }],
            chatType: 'private'
        })
            .populate('sender', 'username')
            .populate('recipient', 'username')
            .sort({ createdAt: -1 })
            .lean();

        const uniqueUsers = [...new Set(
            privateMessages.flatMap(msg => [
                msg.sender._id.toString(),
                msg.recipient._id.toString()
            ]).filter(id => id !== userId.toString())
        )];

        const privateChats = uniqueUsers.map(id => {
            const msg = privateMessages.find(m =>
                m.sender._id.toString() === id || m.recipient._id.toString() === id
            );
            return {
                user: msg.sender._id.toString() === userId.toString() ? msg.recipient : msg.sender,
                lastMessage: msg.content
            };
        });

        const groupChats = await Group.find({ members: userId })
            .select('name members admins')
            .lean();

        return { privateChats, groupChats };
    } catch (error) {
        logger.error('Error fetching user chats:', error);
        throw new AppError('Failed to fetch user chats', 500);
    }
};

const searchMessages = async (userId, query, chatType, chatId, page = 1, limit = 20) => {
    try {
        const baseQuery = { chatType };
        if (chatType === 'private') {
            // Convert string chatId to ObjectId if needed
            const recipientId = typeof chatId === 'string' ? new mongoose.Types.ObjectId(chatId) : chatId;
            baseQuery.$or = [
                { sender: userId, recipient: recipientId },
                { sender: recipientId, recipient: userId }
            ];
        } else {
            // Convert string chatId to ObjectId if needed
            const groupId = typeof chatId === 'string' ? new mongoose.Types.ObjectId(chatId) : chatId;
            const group = await Group.findById(groupId).lean();
            if (!group || !group.members.map(id => id.toString()).includes(userId.toString())) {
                throw new AppError('Access denied to group', 403);
            }
            baseQuery.group = groupId;
        }

        if (query) {
            baseQuery.content = { $regex: query, $options: 'i' };
        }

        const skip = (page - 1) * limit;
        const messages = await Message.find(baseQuery)
            .populate('sender', 'username')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const decompressedMessages = await Promise.all(messages.map(async (msg) => {
            if (msg.isCompressed) {
                try {
                    msg.content = (await decompress(Buffer.from(msg.content, 'base64'))).toString();
                } catch (error) {
                    logger.error('Decompression error:', error);
                }
            }
            return msg;
        }));

        return decompressedMessages;
    } catch (error) {
        logger.error('Error searching messages:', error);
        throw new AppError(error.message || 'Failed to search messages', error.statusCode || 500);
    }
};

const searchMessagesAdvanced = async (userId, query, filters = {}) => {
    try {
        const { chatType, chatId, startDate, endDate, fileType, page = 1, limit = 20 } = filters;
        const baseQuery = { chatType };

        if (chatType === 'private') {
            // Convert string chatId to ObjectId if needed
            const recipientId = typeof chatId === 'string' ? new mongoose.Types.ObjectId(chatId) : chatId;
            baseQuery.$or = [
                { sender: userId, recipient: recipientId },
                { sender: recipientId, recipient: userId }
            ];
        } else if (chatType === 'group') {
            // Convert string chatId to ObjectId if needed
            const groupId = typeof chatId === 'string' ? new mongoose.Types.ObjectId(chatId) : chatId;
            const group = await Group.findById(groupId).lean();
            if (!group || !group.members.map(id => id.toString()).includes(userId.toString())) {
                throw new AppError('Access denied to group', 403);
            }
            baseQuery.group = groupId;
        }

        if (query) {
            baseQuery.content = { $regex: query, $options: 'i' };
        }
        if (startDate) {
            baseQuery.createdAt = { $gte: new Date(startDate) };
        }
        if (endDate) {
            baseQuery.createdAt = { ...baseQuery.createdAt, $lte: new Date(endDate) };
        }
        if (fileType) {
            baseQuery.fileType = fileType;
        }

        const skip = (page - 1) * limit;
        const total = await Message.countDocuments(baseQuery);
        const messages = await Message.find(baseQuery)
            .populate('sender', 'username')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const decompressedMessages = await Promise.all(messages.map(async (msg) => {
            if (msg.isCompressed) {
                try {
                    msg.content = (await decompress(Buffer.from(msg.content, 'base64'))).toString();
                } catch (error) {
                    logger.error('Decompression error:', error);
                }
            }
            return msg;
        }));

        return {
            messages: decompressedMessages,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    } catch (error) {
        logger.error('Error in advanced message search:', error);
        throw new AppError(error.message || 'Failed to search messages', error.statusCode || 500);
    }
};

module.exports = {
    getPrivateMessages,
    getGroupMessages,
    getUserChats,
    searchMessages,
    searchMessagesAdvanced
};
