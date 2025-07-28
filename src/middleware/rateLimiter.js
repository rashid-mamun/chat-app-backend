const rateLimit = require('express-rate-limit');

const rateLimiters = {
    auth: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // 5 attempts
        message: { success: false, message: 'Too many authentication attempts' }
    }),
    messages: rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: 30, // 30 messages per minute
        message: { success: false, message: 'Too many messages sent' }
    })
};

module.exports = { rateLimiters };
