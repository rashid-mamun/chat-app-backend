const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { authenticator } = require('otplib');
const User = require('../models/User');
const { redisClient } = require('../config/redis');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

const generateTokens = (user) => {
    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
        throw new AppError('JWT configuration missing', 500);
    }

    const accessToken = jwt.sign(
        { id: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '15m' }
    );

    const refreshToken = jwt.sign(
        { id: user._id, timestamp: Date.now() },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
    );

    return { accessToken, refreshToken };
};

const register = async ({ username, email, password }) => {
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            throw new AppError('User already exists', 400);
        }

        const user = await User.create({ username, email, password });
        const tokens = generateTokens(user);
        await redisClient.set(`refresh_token:${user._id}`, tokens.refreshToken, {
            EX: 7 * 24 * 60 * 60 // 7 days in seconds
        });

        return { user: { id: user._id, username, email }, tokens };
    } catch (error) {
        logger.error('Error registering user:', error);

        // Handle duplicate key errors
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            if (field === 'email') {
                throw new AppError('User already exists', 400);
            } else if (field === 'username') {
                throw new AppError('Username already taken', 400);
            }
        }

        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => err.message);
            throw new AppError(`Validation failed: ${validationErrors.join(', ')}`, 400);
        }

        throw new AppError(error.message || 'Failed to register user', error.statusCode || 500);
    }
};

const login = async ({ email, password, twoFactorToken }) => {
    try {
        const user = await User.findOne({ email }).select('+password +twoFactorSecret');
        if (!user || !(await user.comparePassword(password))) {
            throw new AppError('Invalid credentials', 401);
        }

        if (user.twoFactorEnabled) {
            if (!twoFactorToken) {
                throw new AppError('2FA token required', 401);
            }
            const isValid = authenticator.verify({ token: twoFactorToken, secret: user.twoFactorSecret });
            if (!isValid) {
                throw new AppError('Invalid 2FA token', 401);
            }
        }

        const tokens = generateTokens(user);
        await redisClient.set(`refresh_token:${user._id}`, tokens.refreshToken, {
            EX: 7 * 24 * 60 * 60 // 7 days in seconds
        });

        return { user: { id: user._id, username: user.username, email: user.email }, tokens };
    } catch (error) {
        logger.error('Error logging in user:', error);
        throw new AppError(error.message || 'Failed to login', error.statusCode || 500);
    }
};

const logout = async (userId) => {
    try {
        await redisClient.del(`refresh_token:${userId}`);
    } catch (error) {
        logger.error('Error logging out user:', error);
        throw new AppError('Failed to logout', 500);
    }
};

const refreshToken = async (refreshToken) => {
    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const storedToken = await redisClient.get(`refresh_token:${decoded.id}`);

        if (!storedToken || storedToken !== refreshToken) {
            throw new AppError('Invalid refresh token', 401);
        }

        const user = await User.findById(decoded.id);
        if (!user) {
            throw new AppError('User not found', 404);
        }

        const tokens = generateTokens(user);
        await redisClient.set(`refresh_token:${user._id}`, tokens.refreshToken, {
            EX: 7 * 24 * 60 * 60 // 7 days in seconds
        });

        return { user: { id: user._id, username: user.username, email: user.email }, tokens };
    } catch (error) {
        logger.error('Error refreshing token:', error);
        if (error.name === 'JsonWebTokenError') {
            throw new AppError('Invalid refresh token', 401);
        }
        throw new AppError(error.message || 'Invalid refresh token', 401);
    }
};

const setup2FA = async (userId) => {
    try {
        // Validate userId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new AppError('User not found', 404);
        }

        const user = await User.findById(userId).select('+twoFactorSecret');
        if (!user) {
            throw new AppError('User not found', 404);
        }

        if (user.twoFactorEnabled) {
            throw new AppError('2FA is already enabled', 400);
        }

        const secret = authenticator.generateSecret();
        const otpauth = authenticator.keyuri(user.email, 'ChatApp', secret);

        // Store the secret temporarily in Redis until verified
        await redisClient.set(`2fa_setup:${user._id}`, secret, {
            EX: 15 * 60 // 15 minutes
        });

        logger.info(`2FA setup initiated for user: ${user.email}, secret: ${secret}, otpauth: ${otpauth}`);
        return { otpauth, secret };
    } catch (error) {
        logger.error('Error setting up 2FA:', error);
        throw new AppError(error.message || 'Failed to set up 2FA', error.statusCode || 500);
    }
};

const verify2FA = async (userId, token) => {
    try {
        // Validate userId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new AppError('User not found', 404);
        }

        const user = await User.findById(userId).select('+twoFactorSecret');
        if (!user) {
            throw new AppError('User not found', 404);
        }

        const secret = await redisClient.get(`2fa_setup:${user._id}`);
        if (!secret) {
            throw new AppError('2FA setup session expired or not found', 400);
        }

        logger.info(`Verifying 2FA for user: ${user.email}, token: ${token}, secret: ${secret}`);

        // Allow a time window of ±30 seconds (1 step before and after)
        const isValid = authenticator.verify({ token, secret, window: 1 });
        if (!isValid) {
            logger.error(`2FA verification failed for user: ${user.email}, token: ${token}`);
            throw new AppError('Invalid 2FA token', 401);
        }

        // Save the 2FA secret to the user and enable 2FA
        user.twoFactorSecret = secret;
        user.twoFactorEnabled = true;
        await user.save({ validateBeforeSave: false });

        // Clean up temporary secret
        await redisClient.del(`2fa_setup:${user._id}`);

        logger.info(`2FA enabled successfully for user: ${user.email}`);
        return { message: '2FA enabled successfully' };
    } catch (error) {
        logger.error('Error verifying 2FA:', error);
        throw new AppError(error.message || 'Failed to verify 2FA', error.statusCode || 500);
    }
};

const getProfile = async (userId) => {
    try {
        const user = await User.findById(userId).select('-password -twoFactorSecret');
        if (!user) {
            throw new AppError('User not found', 404);
        }
        return user;
    } catch (error) {
        logger.error('Error getting user profile:', error);
        throw new AppError(error.message || 'Failed to get profile', error.statusCode || 500);
    }
};

const updateProfile = async (userId, updateData) => {
    try {
        const { username, avatar } = updateData;
        const updateFields = {};

        if (username) {
            const existingUser = await User.findOne({ username, _id: { $ne: userId } });
            if (existingUser) {
                throw new AppError('Username already taken', 400);
            }
            updateFields.username = username;
        }

        if (avatar) {
            updateFields.avatar = avatar;
        }

        const user = await User.findByIdAndUpdate(
            userId,
            updateFields,
            { new: true, runValidators: true }
        ).select('-password -twoFactorSecret');

        if (!user) {
            throw new AppError('User not found', 404);
        }

        return user;
    } catch (error) {
        logger.error('Error updating user profile:', error);
        throw new AppError(error.message || 'Failed to update profile', error.statusCode || 500);
    }
};

const changePassword = async (userId, currentPassword, newPassword) => {
    try {
        const user = await User.findById(userId).select('+password');
        if (!user) {
            throw new AppError('User not found', 404);
        }

        const isCurrentPasswordValid = await user.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
            throw new AppError('Current password is incorrect', 400);
        }

        user.password = newPassword;
        await user.save();

        // Invalidate all refresh tokens for this user
        await redisClient.del(`refresh_token:${userId}`);

        logger.info(`Password changed for user: ${user.email}`);
    } catch (error) {
        logger.error('Error changing password:', error);

        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => err.message);
            throw new AppError(`Validation failed: ${validationErrors.join(', ')}`, 400);
        }

        // Handle duplicate key errors
        if (error.code === 11000) {
            throw new AppError('Username already taken', 400);
        }

        throw new AppError(error.message || 'Failed to change password', error.statusCode || 500);
    }
};

module.exports = {
    register,
    login,
    logout,
    refreshToken,
    setup2FA,
    verify2FA,
    getProfile,
    updateProfile,
    changePassword
};