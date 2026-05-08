const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { searchUsers, getAllUsers, toggleMuteChat, toggleBlockUser } = require('../controllers/userController');

router.get('/search', authMiddleware, searchUsers);
router.get('/all', authMiddleware, getAllUsers);
router.post('/toggle-mute', authMiddleware, toggleMuteChat);
router.post('/toggle-block', authMiddleware, toggleBlockUser);

module.exports = router;
