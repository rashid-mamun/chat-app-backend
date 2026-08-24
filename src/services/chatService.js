const mongoose = require('mongoose');
const Message = require('../models/Message');
const Group = require('../models/Group');
const User = require('../models/User');
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
            ],
            isDeleted: { $ne: true }
        })
            .populate('sender', 'username')
            .populate({
                path: 'replyTo',
                populate: { path: 'sender', select: 'username' }
            })
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
        const messages = await Message.find({ group: groupId, chatType: 'group', isDeleted: { $ne: true } })
            .populate('sender', 'username')
            .populate({
                path: 'replyTo',
                populate: { path: 'sender', select: 'username' }
            })
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
        const objectUserId = new mongoose.Types.ObjectId(userId);
        const privateMatch = {
            $or: [{ sender: objectUserId }, { recipient: objectUserId }],
            chatType: 'private',
            isDeleted: { $ne: true }
        };

        // Only return the newest message for each private conversation. Loading every
        // historical message here made the sidebar progressively slower as data grew.
        const [latestPrivateMessages, unreadPrivate, user, groupChats] = await Promise.all([
            Message.aggregate([
                { $match: privateMatch },
                {
                    $addFields: {
                        otherUser: { $cond: [{ $eq: ['$sender', objectUserId] }, '$recipient', '$sender'] }
                    }
                },
                { $sort: { createdAt: -1 } },
                { $group: { _id: '$otherUser', message: { $first: '$$ROOT' } } }
            ]),
            Message.aggregate([
            {
                $match: {
                    recipient: objectUserId,
                    chatType: 'private',
                    isDeleted: { $ne: true },
                    'readBy.user': { $ne: objectUserId }
                }
            },
            { $group: { _id: '$sender', count: { $sum: 1 } } }
            ]),
            User.findById(userId).select('conversationPreferences').lean(),
            Group.find({ members: userId })
                .populate('members', 'username email avatar isOnline status lastSeen')
                .populate('admins', 'username email avatar')
                .lean()
        ]);

        const privateUserIds = latestPrivateMessages.map(item => item._id).filter(Boolean);
        const privateUsers = await User.find({ _id: { $in: privateUserIds } })
            .select('username avatar isOnline lastSeen')
            .lean();
        const privateUserMap = new Map(privateUsers.map(item => [String(item._id), item]));
        const privateUnreadMap = new Map(unreadPrivate.map(item => [String(item._id), item.count]));
        const preferenceMap = new Map((user?.conversationPreferences || []).map(pref => [
            `${pref.chatType}:${pref.chatId}`,
            pref
        ]));

        const privateChats = latestPrivateMessages.flatMap(({ _id, message: msg }) => {
            const id = String(_id);
            const otherUser = privateUserMap.get(id);
            // A deleted account can leave historical messages behind; skip it instead
            // of making the entire conversations endpoint fail with a null dereference.
            if (!otherUser || !msg) return [];
            const preferences = preferenceMap.get(`private:${id}`) || {};
            return [{
                _id: otherUser._id,
                user: otherUser,
                lastMessage: {
                    content: msg.content,
                    createdAt: msg.createdAt,
                    sender: msg.sender
                },
                unreadCount: privateUnreadMap.get(id) || 0,
                preferences
            }];
        });

        const groupIds = groupChats.map(group => group._id);
        const [lastGroupMessages, unreadGroups] = await Promise.all([
            Message.aggregate([
                { $match: { group: { $in: groupIds }, chatType: 'group', isDeleted: { $ne: true } } },
                { $sort: { createdAt: -1 } },
                { $group: { _id: '$group', message: { $first: '$$ROOT' } } }
            ]),
            Message.aggregate([
                {
                    $match: {
                        group: { $in: groupIds },
                        chatType: 'group',
                        sender: { $ne: new mongoose.Types.ObjectId(userId) },
                        isDeleted: { $ne: true },
                        'readBy.user': { $ne: new mongoose.Types.ObjectId(userId) }
                    }
                },
                { $group: { _id: '$group', count: { $sum: 1 } } }
            ])
        ]);
        const groupLastMap = new Map(lastGroupMessages.map(item => [String(item._id), item.message]));
        const groupUnreadMap = new Map(unreadGroups.map(item => [String(item._id), item.count]));
        const hydratedGroupChats = groupChats.map(group => ({
            ...group,
            lastMessage: groupLastMap.get(String(group._id)) || null,
            unreadCount: groupUnreadMap.get(String(group._id)) || 0,
            preferences: preferenceMap.get(`group:${group._id}`) || {}
        }));

        return { privateChats, groupChats: hydratedGroupChats };
    } catch (error) {
        logger.error('Error fetching user chats:', error);
        throw new AppError('Failed to fetch user chats', 500);
    }
};

const markChatAsRead = async (userId, chatType, chatId) => {
    const objectUserId = new mongoose.Types.ObjectId(userId);
    const objectChatId = new mongoose.Types.ObjectId(chatId);
    const query = chatType === 'private'
        ? { chatType, sender: objectChatId, recipient: objectUserId, isDeleted: { $ne: true } }
        : { chatType, group: objectChatId, sender: { $ne: objectUserId }, isDeleted: { $ne: true } };

    if (chatType === 'group') {
        const isMember = await Group.exists({ _id: objectChatId, members: objectUserId });
        if (!isMember) throw new AppError('Access denied to group', 403);
    }

    const readAt = new Date();
    const result = await Message.updateMany(
        { ...query, 'readBy.user': { $ne: objectUserId } },
        { $push: { readBy: { user: objectUserId, readAt } } }
    );

    await User.updateOne(
        { _id: objectUserId, conversationPreferences: { $elemMatch: { chatId: objectChatId, chatType } } },
        { $set: { 'conversationPreferences.$.markedUnread': false, 'conversationPreferences.$.updatedAt': readAt } }
    );

    return { readAt, modifiedCount: result.modifiedCount };
};

const updateConversationPreferences = async (userId, chatType, chatId, changes) => {
    const allowed = ['isPinned', 'isArchived', 'markedUnread', 'draft'];
    const updates = Object.fromEntries(Object.entries(changes).filter(([key]) => allowed.includes(key)));
    if (!Object.keys(updates).length) throw new AppError('No valid preference fields supplied', 400);

    const user = await User.findById(userId);
    const existing = user.conversationPreferences.find(pref =>
        String(pref.chatId) === String(chatId) && pref.chatType === chatType
    );

    if (existing) {
        Object.assign(existing, updates, { updatedAt: new Date() });
    } else {
        user.conversationPreferences.push({ chatId, chatType, ...updates });
    }
    await user.save({ validateBeforeSave: true });
    return user.conversationPreferences.find(pref =>
        String(pref.chatId) === String(chatId) && pref.chatType === chatType
    );
};

const searchMessages = async (userId, query, chatType, chatId, page = 1, limit = 20) => {
    try {
        const baseQuery = { chatType, isDeleted: false };
        if (query) {
            baseQuery.content = { $regex: query, $options: 'i' };
        }

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
        const baseQuery = { isDeleted: false };

        if (chatType === 'private') {
            baseQuery.chatType = 'private';
            if (chatId) {
                const recipientId = typeof chatId === 'string' ? new mongoose.Types.ObjectId(chatId) : chatId;
                baseQuery.$or = [
                    { sender: userId, recipient: recipientId },
                    { sender: recipientId, recipient: userId }
                ];
            } else {
                baseQuery.$or = [
                    { sender: userId },
                    { recipient: userId }
                ];
            }
        } else if (chatType === 'group') {
            baseQuery.chatType = 'group';
            if (chatId) {
                const groupId = typeof chatId === 'string' ? new mongoose.Types.ObjectId(chatId) : chatId;
                const group = await Group.findById(groupId).lean();
                if (!group || !group.members.map(id => id.toString()).includes(userId.toString())) {
                    throw new AppError('Access denied to group', 403);
                }
                baseQuery.group = groupId;
            } else {
                const groups = await Group.find({ members: userId }).select('_id').lean();
                baseQuery.group = { $in: groups.map(g => g._id) };
            }
        } else {
            // ALL CHATS
            const groups = await Group.find({ members: userId }).select('_id').lean();
            baseQuery.$or = [
                { chatType: 'private', $or: [{ sender: userId }, { recipient: userId }] },
                { chatType: 'group', group: { $in: groups.map(g => g._id) } }
            ];
        }

        if (query) {
            baseQuery.content = { $regex: query, $options: 'i' };
        }
        if (startDate) {
            baseQuery.createdAt = { $gte: new Date(startDate) };
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            baseQuery.createdAt = { ...baseQuery.createdAt, $lte: end };
        }
        if (fileType) {
            baseQuery.fileType = fileType;
        }

        const skip = (page - 1) * limit;
        const total = await Message.countDocuments(baseQuery);
        const messages = await Message.find(baseQuery)
            .populate('sender', 'username')
            .populate('recipient', 'username email avatar status isOnline lastSeen')
            .populate('group', 'name members admins description avatar')
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

const clearChat = async (userId, chatType, chatId) => {
    try {
        const query = { chatType };
        if (chatType === 'private') {
            const recipientId = typeof chatId === 'string' ? new mongoose.Types.ObjectId(chatId) : chatId;
            query.$or = [
                { sender: userId, recipient: recipientId },
                { sender: recipientId, recipient: userId }
            ];
        } else {
            const groupId = typeof chatId === 'string' ? new mongoose.Types.ObjectId(chatId) : chatId;
            query.group = groupId;
        }

        // Soft delete all messages in this chat
        const result = await Message.updateMany(query, { isDeleted: true, deletedAt: new Date() });
        return true;
    } catch (error) {
        logger.error('Error clearing chat:', error);
        throw new AppError('Failed to clear chat', 500);
    }
};

module.exports = {
    getPrivateMessages,
    getGroupMessages,
    getUserChats,
    searchMessages,
    searchMessagesAdvanced,
    markChatAsRead,
    updateConversationPreferences,
    compress,
    clearChat
};
