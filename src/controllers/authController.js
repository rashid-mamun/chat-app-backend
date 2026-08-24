const { authenticator } = require('otplib');
const qrcode = require('qrcode');
const authService = require('../services/authService');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const refreshCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/api/v1/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000
};

const sendAuthResult = (res, status, message, result) => {
    res.cookie('refreshToken', result.tokens.refreshToken, refreshCookieOptions);
    const tokens = process.env.NODE_ENV === 'test'
        ? result.tokens
        : { accessToken: result.tokens.accessToken };
    return res.status(status).json({
        success: true,
        message,
        data: { ...result, tokens }
    });
};

const register = async (req, res, next) => {
    try {
        const { username, email, password } = req.body;
        const result = await authService.register({ username, email, password });

        logger.info(`User registered successfully: ${email}`);
        sendAuthResult(res, 201, 'User registered successfully', result);
    } catch (error) {
        next(error);
    }
};

const login = async (req, res, next) => {
    try {
        const { email, password, twoFactorToken } = req.body;
        const result = await authService.login({ email, password, twoFactorToken });

        logger.info(`User logged in: ${email}`);
        sendAuthResult(res, 200, 'Login successful', result);
    } catch (error) {
        next(error);
    }
};

const logout = async (req, res, next) => {
    try {
        const token = req.header('Authorization').split(' ')[1];
        await authService.logout(req.user._id, token);
        const { maxAge, ...clearCookieOptions } = refreshCookieOptions;
        res.clearCookie('refreshToken', clearCookieOptions);

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
        const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
        if (!refreshToken) throw new AppError('Refresh token is required', 401);
        const result = await authService.refreshToken(refreshToken);
        sendAuthResult(res, 200, 'Token refreshed', result);
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
        const { username, avatar, bio } = req.body;
        const result = await authService.updateProfile(req.user._id, { username, avatar, bio });

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

const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) {
            throw new AppError('Email is required', 400);
        }

        const result = await authService.forgotPassword(email);
        res.json({
            success: true,
            message: result.message
        });
    } catch (error) {
        next(error);
    }
};

const resetPassword = async (req, res, next) => {
    try {
        const { token } = req.params;
        const { newPassword } = req.body;

        if (!newPassword) {
            throw new AppError('New password is required', 400);
        }

        const result = await authService.resetPassword(token, newPassword);
        res.json({
            success: true,
            message: result.message
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
    changePassword,
    forgotPassword,
    resetPassword
};
