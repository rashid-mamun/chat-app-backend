const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { searchUsers, getAllUsers } = require('../controllers/userController');

router.get('/search', authMiddleware, searchUsers);
router.get('/all', authMiddleware, getAllUsers);

module.exports = router;
