const rateLimit = require('express-rate-limit');

const rateLimiters = {
    auth: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: process.env.NODE_ENV === 'production' ? 10 : 100, // 100 attempts in development
        message: { success: false, message: 'Too many authentication attempts. Please try again later.' }
    }),
    messages: rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: process.env.NODE_ENV === 'production' ? 60 : 300,
        message: { success: false, message: 'Too many messages sent' }
    })
};

module.exports = { rateLimiters };
