const express = require('express');
const router = express.Router();
const { registerValidator, loginValidator } = require('../validators/authValidator');
const { authMiddleware } = require('../middleware/auth');
const { rateLimiters } = require('../middleware/rateLimiter');
const { register, login, logout, refreshToken, setup2FA, verify2FA, getProfile, updateProfile, changePassword } = require('../controllers/authController');

// Authentication routes
router.post('/register', rateLimiters.auth, registerValidator, register);
router.post('/login', rateLimiters.auth, loginValidator, login);
router.post('/logout', authMiddleware, logout);
router.post('/refresh-token', refreshToken);

// 2FA routes
router.post('/2fa/setup', authMiddleware, setup2FA);
router.post('/2fa/verify', authMiddleware, verify2FA);

// User profile routes
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);
router.put('/change-password', authMiddleware, changePassword);

module.exports = router;