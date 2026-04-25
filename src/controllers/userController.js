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

        console.log(`Searching for: "${query}" (excluding ${currentUserId}). Found: ${users.length} users.`);

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

module.exports = {
    searchUsers,
    getAllUsers
};
