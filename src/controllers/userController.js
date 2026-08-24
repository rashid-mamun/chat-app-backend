const User = require('../models/User');
const Message = require('../models/Message');
const Group = require('../models/Group');
const Report = require('../models/Report');
const { AppError } = require('../middleware/errorHandler');

const searchUsers = async (req, res, next) => {
    try {
        const { query } = req.query;
        const currentUserId = req.user._id;

        const users = await User.find({
            _id: { $ne: currentUserId },
            $or: [
                { username: { $regex: query || '', $options: 'i' } },
                { email: { $regex: query || '', $options: 'i' } }
            ]
        })
            .select('username email avatar isOnline status')
            .limit(20);

        res.json({
            success: true,
            data: users
        });
    } catch (error) {
        next(error);
    }
};

const getAllUsers = async (req, res, next) => {
    try {
        const currentUserId = req.user._id;
        const users = await User.find({ _id: { $ne: currentUserId } })
            .select('username email avatar isOnline status')
            .limit(50);

        res.json({
            success: true,
            data: users
        });
    } catch (error) {
        next(error);
    }
};

const toggleMuteChat = async (req, res, next) => {
    try {
        const { chatId, chatType } = req.body;
        const user = await User.findById(req.user._id);

        const index = user.mutedChats.findIndex(m =>
            m.chatId.toString() === chatId.toString() && m.chatType === chatType
        );

        let isMuted = false;
        if (index > -1) {
            user.mutedChats.splice(index, 1);
            isMuted = false;
        } else {
            user.mutedChats.push({ chatId, chatType });
            isMuted = true;
        }

        await user.save();

        res.json({
            success: true,
            message: isMuted ? 'Chat muted' : 'Chat unmuted',
            data: { isMuted }
        });
    } catch (error) {
        next(error);
    }
};

const toggleBlockUser = async (req, res, next) => {
    try {
        const { targetUserId } = req.body;
        const user = await User.findById(req.user._id);

        if (String(req.user._id) === String(targetUserId)) {
            return next(new AppError('You cannot block yourself', 400));
        }

        const index = user.blockedUsers.indexOf(targetUserId);

        let isBlocked = false;
        if (index > -1) {
            user.blockedUsers.splice(index, 1);
            isBlocked = false;
        } else {
            user.blockedUsers.push(targetUserId);
            isBlocked = true;
        }

        await user.save();

        res.json({
            success: true,
            message: isBlocked ? 'User blocked' : 'User unblocked',
            data: { isBlocked }
        });
    } catch (error) {
        next(error);
    }
};

const canAccessMessage = async (userId, message) => {
    if (message.chatType === 'private') {
        return [message.sender, message.recipient].some(id => String(id) === String(userId));
    }
    return Boolean(await Group.exists({ _id: message.group, members: userId }));
};

const toggleSavedMessage = async (req, res, next) => {
    try {
        const { messageId } = req.body;
        const message = await Message.findById(messageId);
        if (!message || !(await canAccessMessage(req.user._id, message))) {
            throw new AppError('Message not found', 404);
        }

        const user = await User.findById(req.user._id);
        const index = user.savedMessages.findIndex(id => String(id) === String(messageId));
        const isSaved = index === -1;
        if (isSaved) user.savedMessages.push(messageId);
        else user.savedMessages.splice(index, 1);
        await user.save();
        res.json({ success: true, data: { isSaved } });
    } catch (error) {
        next(error);
    }
};

const getSavedMessages = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id).populate({
            path: 'savedMessages',
            match: { isDeleted: { $ne: true } },
            populate: { path: 'sender', select: 'username avatar' },
            options: { sort: { createdAt: -1 } }
        });
        res.json({ success: true, data: user.savedMessages });
    } catch (error) {
        next(error);
    }
};

const reportMessage = async (req, res, next) => {
    try {
        const { messageId, reason, details = '' } = req.body;
        const message = await Message.findById(messageId);
        if (!message || !(await canAccessMessage(req.user._id, message))) {
            throw new AppError('Message not found', 404);
        }
        if (String(message.sender) === String(req.user._id)) {
            throw new AppError('You cannot report your own message', 400);
        }
        const report = await Report.create({
            reporter: req.user._id,
            reportedUser: message.sender,
            message: message._id,
            reason,
            details
        });
        res.status(201).json({ success: true, message: 'Report submitted', data: { id: report._id } });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    searchUsers,
    getAllUsers,
    toggleMuteChat,
    toggleBlockUser,
    toggleSavedMessage,
    getSavedMessages,
    reportMessage
};
