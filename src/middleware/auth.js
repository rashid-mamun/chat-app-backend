const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError } = require('./errorHandler');
const { redisClient } = require('../config/redis');

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next(new AppError('Access token is required', 401));
        }

        const token = authHeader.split(' ')[1];

        const blacklisted = await redisClient.get(`blacklist:${token}`);
        if (blacklisted) {
            return next(new AppError('Token has been revoked', 401));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id);
        if (!user) {
            return next(new AppError('User no longer exists', 401));
        }

        if (user.status !== 'active') {
            return next(new AppError('User account is not active', 401));
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return next(new AppError('Invalid token', 401));
        } else if (error.name === 'TokenExpiredError') {
            return next(new AppError('Token expired', 401));
        }
        next(error);
    }
};

const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id);

            if (user && user.status === 'active') {
                req.user = user;
            }
        }

        next();
    } catch (error) {
        next();
    }
};

module.exports = { authMiddleware, optionalAuth };