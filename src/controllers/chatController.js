const { getPrivateMessages, getGroupMessages, getUserChats, searchMessages, searchMessagesAdvanced } = require('../services/chatService');
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
            if (!group.members.includes(req.user._id) || !group.admins.includes(req.user._id)) {
                throw new AppError('Only group admins can pin messages', 403);
            }
        } else if (message.chatType === 'private' &&
            ![message.sender.toString(), message.recipient.toString()].includes(req.user._id.toString())) {
            throw new AppError('Access denied', 403);
        }

        message.isPinned = true;
        message.pinnedBy = req.user._id;
        message.pinnedAt = new Date();
        await message.save();

        const targetRoom = message.chatType === 'private'
            ? [message.sender.toString(), message.recipient.toString()].sort().join('-')
            : `group:${message.group}`;

        req.app.locals.io.to(targetRoom).emit('messagePinned', {
            messageId,
            pinnedBy: req.user._id,
            pinnedAt: message.pinnedAt
        });

        res.json({
            success: true,
            message: 'Message pinned successfully'
        });
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

        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

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

module.exports = {
    getPrivateMessagesController,
    getGroupMessagesController,
    getUserChatsController,
    searchMessagesController,
    searchMessagesAdvancedController,
    pinMessage,
    deleteMessage,
    editMessage,
    uploadFile
};