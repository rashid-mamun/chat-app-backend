const { body, validationResult, param } = require('express-validator');
const rateLimit = require('express-rate-limit');

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
        });
    }
    next();
};

const registerValidation = [
    body('username')
        .trim()
        .isLength({ min: 3, max: 20 })
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username must be 3-20 characters, alphanumeric and underscores only'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),
    body('password')
        .isLength({ min: 8 })
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must be at least 8 characters with uppercase, lowercase, number, and special character'),
    handleValidationErrors
];

const messageValidation = [
    body('content')
        .trim()
        .isLength({ min: 1, max: 1000 })
        .withMessage('Message must be 1-1000 characters'),
    handleValidationErrors
];

const pinMessageValidation = [
    param('messageId')
        .isMongoId()
        .withMessage('Invalid message ID'),
    handleValidationErrors
];

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

module.exports = { registerValidation, messageValidation, pinMessageValidation, rateLimiters };
