const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { rateLimiters } = require('../middleware/rateLimiter');
const { pinMessageValidation, messageValidation } = require('../middleware/validation');
const { upload } = require('../services/fileService');
const {
    getPrivateMessagesController,
    getGroupMessagesController,
    getUserChatsController,
    searchMessagesController,
    searchMessagesAdvancedController,
    pinMessage,
    deleteMessage,
    editMessage,
    uploadFile
} = require('../controllers/chatController');

// Message retrieval routes
router.get('/private/:recipientId', authMiddleware, getPrivateMessagesController);
router.get('/group/:groupId', authMiddleware, getGroupMessagesController);
router.get('/user', authMiddleware, getUserChatsController);

// Search routes
router.get('/messages/search', authMiddleware, searchMessagesController);
router.get('/messages/search/advanced', authMiddleware, searchMessagesAdvancedController);

// Message management routes
router.post('/messages/:messageId/pin', authMiddleware, pinMessageValidation, pinMessage);
router.delete('/messages/:messageId', authMiddleware, deleteMessage);
router.put('/messages/:messageId', authMiddleware, messageValidation, editMessage);

// File upload route
router.post('/upload', authMiddleware, (req, res, next) => {
    upload(req, res, (err) => {
        if (err) {
            if (err.message === 'Invalid file type') {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid file type'
                });
            }
            return next(err);
        }
        next();
    });
}, uploadFile);

module.exports = router;