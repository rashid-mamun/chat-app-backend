const { authenticator } = require('otplib');
const qrcode = require('qrcode');
const authService = require('../services/authService');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const register = async (req, res, next) => {
    try {
        const { username, email, password } = req.body;
        const result = await authService.register({ username, email, password });

        logger.info(`User registered successfully: ${email}`);
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

const login = async (req, res, next) => {
    try {
        const { email, password, twoFactorToken } = req.body;
        const result = await authService.login({ email, password, twoFactorToken });

        logger.info(`User logged in: ${email}`);
        res.json({
            success: true,
            message: 'Login successful',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

const logout = async (req, res, next) => {
    try {
        await authService.logout(req.user._id);

        res.json({
            success: true,
            message: 'Logout successful'
        });
    } catch (error) {
        next(error);
    }
};

const refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        const result = await authService.refreshToken(refreshToken);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

const setup2FA = async (req, res, next) => {
    try {
        const result = await authService.setup2FA(req.user._id);
        const qrCode = await qrcode.toDataURL(result.otpauth);

        res.json({
            success: true,
            data: { qrCode, secret: result.secret }
        });
    } catch (error) {
        next(error);
    }
};

const verify2FA = async (req, res, next) => {
    try {
        const { token } = req.body;
        const result = await authService.verify2FA(req.user._id, token);

        res.json({
            success: true,
            message: result.message
        });
    } catch (error) {
        next(error);
    }
};

const getProfile = async (req, res, next) => {
    try {
        const user = await authService.getProfile(req.user._id);
        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        next(error);
    }
};

const updateProfile = async (req, res, next) => {
    try {
        const { username, avatar } = req.body;
        const result = await authService.updateProfile(req.user._id, { username, avatar });

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

const changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        await authService.changePassword(req.user._id, currentPassword, newPassword);

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        next(error);
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