const User = require('../models/User');
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

module.exports = {
    searchUsers,
    getAllUsers,
    toggleMuteChat,
    toggleBlockUser
};
