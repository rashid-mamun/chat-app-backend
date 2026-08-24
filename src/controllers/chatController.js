const {
    getPrivateMessages,
    getGroupMessages,
    getUserChats,
    searchMessages,
    searchMessagesAdvanced,
    clearChat,
    markChatAsRead,
    updateConversationPreferences
} = require('../services/chatService');
const { AppError } = require('../middleware/errorHandler');
const Message = require('../models/Message');
const Group = require('../models/Group');
const logger = require('../utils/logger');

const getPrivateMessagesController = async (req, res, next) => {
    try {
        const { recipientId } = req.params;
        const { page, limit } = req.query;
        const messages = await getPrivateMessages(req.user._id, recipientId, parseInt(page) || 1, parseInt(limit) || 50);

        res.json({
            success: true,
            data: messages
        });
    } catch (error) {
        next(error);
    }
};

const getGroupMessagesController = async (req, res, next) => {
    try {
        const { groupId } = req.params;
        const { page, limit } = req.query;
        const messages = await getGroupMessages(groupId, req.user._id, parseInt(page) || 1, parseInt(limit) || 50);

        res.json({
            success: true,
            data: messages
        });
    } catch (error) {
        next(error);
    }
};

const getUserChatsController = async (req, res, next) => {
    try {
        const chats = await getUserChats(req.user._id);

        res.json({
            success: true,
            data: chats
        });
    } catch (error) {
        next(error);
    }
};

const searchMessagesController = async (req, res, next) => {
    try {
        const { query, chatType, chatId, page, limit } = req.query;
        const messages = await searchMessages(req.user._id, query, chatType, chatId, parseInt(page) || 1, parseInt(limit) || 20);

        res.json({
            success: true,
            data: messages
        });
    } catch (error) {
        next(error);
    }
};

const searchMessagesAdvancedController = async (req, res, next) => {
    try {
        const { query, chatType, chatId, startDate, endDate, senderId, fileType, page, limit } = req.query;
        const result = await searchMessagesAdvanced(req.user._id, query, {
            chatType,
            chatId,
            startDate,
            endDate,
            senderId,
            fileType,
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 20
        });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

const pinMessage = async (req, res, next) => {
    try {
        const { messageId } = req.params;
        const message = await Message.findById(messageId);

        if (!message || message.isDeleted) {
            throw new AppError('Message not found', 404);
        }

        if (message.chatType === 'group') {
            const group = await Group.findById(message.group);
            if (!group || !group.admins.some(admin => admin.toString() === req.user._id.toString())) {
                throw new AppError('Only group admins can pin messages', 403);
            }
        } else if (message.chatType === 'private' &&
            ![message.sender.toString(), message.recipient.toString()].includes(req.user._id.toString())) {
            throw new AppError('Access denied', 403);
        }

        message.isPinned = !message.isPinned;
        message.pinnedBy = message.isPinned ? req.user._id : undefined;
        message.pinnedAt = message.isPinned ? new Date() : undefined;
        await message.save();

        const targetRoom = message.chatType === 'private'
            ? [message.sender.toString(), message.recipient.toString()].sort().join('-')
            : `group:${message.group}`;

        req.app.locals.io.to(targetRoom).emit('messagePinUpdated', {
            messageId,
            isPinned: message.isPinned,
            pinnedBy: req.user._id,
            pinnedAt: message.pinnedAt
        });

        res.json({
            success: true,
            message: message.isPinned ? 'Message pinned successfully' : 'Message unpinned successfully',
            data: message
        });
    } catch (error) {
        next(error);
    }
};

const markChatReadController = async (req, res, next) => {
    try {
        const { chatType, chatId } = req.body;
        if (!['private', 'group'].includes(chatType) || !chatId) {
            throw new AppError('Valid chatType and chatId are required', 400);
        }

        const result = await markChatAsRead(req.user._id, chatType, chatId);
        const targetRoom = chatType === 'private'
            ? [req.user._id.toString(), chatId.toString()].sort().join('-')
            : `group:${chatId}`;
        req.app.locals.io.to(targetRoom).emit('chatRead', {
            chatType,
            chatId,
            userId: req.user._id,
            readAt: result.readAt
        });

        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

const updateConversationPreferencesController = async (req, res, next) => {
    try {
        const { chatType, chatId } = req.params;
        if (!['private', 'group'].includes(chatType)) {
            throw new AppError('Invalid chat type', 400);
        }
        const preferences = await updateConversationPreferences(req.user._id, chatType, chatId, req.body);
        res.json({ success: true, data: preferences });
    } catch (error) {
        next(error);
    }
};

const deleteMessage = async (req, res, next) => {
    try {
        const { messageId } = req.params;
        const message = await Message.findById(messageId);

        if (!message || message.isDeleted) {
            throw new AppError('Message not found', 404);
        }

        // Check if user can delete the message
        if (message.sender.toString() !== req.user._id.toString()) {
            throw new AppError('You can only delete your own messages', 403);
        }

        await message.softDelete();

        const targetRoom = message.chatType === 'private'
            ? [message.sender.toString(), message.recipient.toString()].sort().join('-')
            : `group:${message.group}`;

        req.app.locals.io.to(targetRoom).emit('messageDeleted', {
            messageId,
            deletedBy: req.user._id
        });

        res.json({
            success: true,
            message: 'Message deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

const editMessage = async (req, res, next) => {
    try {
        const { messageId } = req.params;
        const { content } = req.body;
        const message = await Message.findById(messageId);

        if (!message || message.isDeleted) {
            throw new AppError('Message not found', 404);
        }

        if (message.sender.toString() !== req.user._id.toString()) {
            throw new AppError('You can only edit your own messages', 403);
        }

        message.content = content;
        message.editedAt = new Date();
        await message.save();

        const targetRoom = message.chatType === 'private'
            ? [message.sender.toString(), message.recipient.toString()].sort().join('-')
            : `group:${message.group}`;

        req.app.locals.io.to(targetRoom).emit('messageEdited', {
            messageId,
            content,
            editedAt: message.editedAt
        });

        res.json({
            success: true,
            message: 'Message edited successfully',
            data: message
        });
    } catch (error) {
        next(error);
    }
};

const uploadFile = async (req, res, next) => {
    try {
        if (!req.file) {
            throw new AppError('No file uploaded', 400);
        }

        const baseUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
        const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;

        res.json({
            success: true,
            message: 'File uploaded successfully',
            data: {
                fileName: req.file.originalname,
                fileUrl,
                fileSize: req.file.size,
                fileType: req.file.mimetype
            }
        });
    } catch (error) {
        next(error);
    }
};

const clearChatController = async (req, res, next) => {
    try {
        const { chatType, chatId } = req.body;
        await clearChat(req.user._id, chatType, chatId);

        const io = req.app.locals.io;
        if (chatType === 'private') {
            const room = [req.user._id.toString(), chatId.toString()].sort().join('-');
            io.to(room).to(`user:${req.user._id}`).to(`user:${chatId}`).emit('chatCleared', {
                chatType,
                chatId,
                clearedBy: req.user._id
            });
        } else {
            io.to(`group:${chatId}`).emit('chatCleared', {
                chatType,
                chatId,
                clearedBy: req.user._id
            });
        }

        res.json({
            success: true,
            message: 'Chat cleared successfully'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getPrivateMessagesController,
    getGroupMessagesController,
    getUserChatsController,
    searchMessagesController,
    searchMessagesAdvancedController,
    pinMessage,
    deleteMessage,
    editMessage,
    uploadFile,
    clearChatController,
    markChatReadController,
    updateConversationPreferencesController
};
