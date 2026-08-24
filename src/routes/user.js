const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { searchUsers, getAllUsers, toggleMuteChat, toggleBlockUser, toggleSavedMessage, getSavedMessages, reportMessage } = require('../controllers/userController');

router.get('/search', authMiddleware, searchUsers);
router.get('/all', authMiddleware, getAllUsers);
router.post('/toggle-mute', authMiddleware, toggleMuteChat);
router.post('/toggle-block', authMiddleware, toggleBlockUser);
router.get('/saved-messages', authMiddleware, getSavedMessages);
router.post('/toggle-save-message', authMiddleware, toggleSavedMessage);
router.post('/report-message', authMiddleware, reportMessage);

module.exports = router;
