const { register, login, logout, refreshToken, setup2FA, verify2FA } = require('../../services/authService');
const User = require('../../models/User');
const { redisClient } = require('../../config/redis');
const { authenticator } = require('otplib');
const { AppError } = require('../../middleware/errorHandler');
const mongoose = require('mongoose');

describe('Auth Service', () => {
    beforeEach(async () => {
        await User.deleteMany({});
        await redisClient.flushAll();
    });

    describe('register', () => {
        it('should register a new user successfully', async () => {
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'Password123!'
            };

            const result = await register(userData);
            expect(result.user).toHaveProperty('id');
            expect(result.user.username).toBe('testuser');
            expect(result.user.email).toBe('test@example.com');
            expect(result.tokens).toHaveProperty('accessToken');
            expect(result.tokens).toHaveProperty('refreshToken');

            const storedToken = await redisClient.get(`refresh_token:${result.user.id}`);
            expect(storedToken).toBe(result.tokens.refreshToken);

            const user = await User.findById(result.user.id);
            expect(user).toBeDefined();
            expect(user.username).toBe('testuser');
        });

        it('should throw error for duplicate email', async () => {
            await register({
                username: 'testuser',
                email: 'test@example.com',
                password: 'Password123!'
            });

            await expect(register({
                username: 'testuser2',
                email: 'test@example.com',
                password: 'Password123!'
            })).rejects.toThrow('User already exists');
        });
    });

    describe('login', () => {
        it('should login successfully with valid credentials', async () => {
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'Password123!'
            };

            await register(userData);

            const result = await login({
                email: 'test@example.com',
                password: 'Password123!'
            });

            expect(result.user).toHaveProperty('id');
            expect(result.user.username).toBe('testuser');
            expect(result.tokens).toHaveProperty('accessToken');
            expect(result.tokens).toHaveProperty('refreshToken');

            const storedToken = await redisClient.get(`refresh_token:${result.user.id}`);
            expect(storedToken).toBe(result.tokens.refreshToken);
        });

        it('should throw error for invalid credentials', async () => {
            await expect(login({
                email: 'test@example.com',
                password: 'WrongPassword!'
            })).rejects.toThrow('Invalid credentials');
        });

        it('should require 2FA token when enabled', async () => {
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'Password123!'
            };

            const { user } = await register(userData);
            const secret = authenticator.generateSecret();
            await User.findByIdAndUpdate(user.id, {
                twoFactorSecret: secret,
                twoFactorEnabled: true
            });

            await expect(login({
                email: 'test@example.com',
                password: 'Password123!'
            })).rejects.toThrow('2FA token required');

            // Ensure user exists before accessing twoFactorSecret
            const updatedUser = await User.findById(user.id).select('+twoFactorSecret');
            // expect(updatedUser).not.toBeNull();
            const twoFactorToken = authenticator.generate(updatedUser.twoFactorSecret);
            const result = await login({
                email: 'test@example.com',
                password: 'Password123!',
                twoFactorToken
            });

            expect(result.user).toHaveProperty('id');
            expect(result.user.username).toBe('testuser');
            expect(result.tokens).toHaveProperty('accessToken');
            expect(result.tokens).toHaveProperty('refreshToken');
        });
    });

    describe('logout', () => {
        it('should remove refresh token on logout', async () => {
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'Password123!'
            };

            const { user, tokens } = await register(userData);
            await logout(user.id);

            const storedToken = await redisClient.get(`refresh_token:${user.id}`);
            expect(storedToken).toBeNull();
        });
    });

    describe('refreshToken', () => {
        it('should refresh token successfully', async () => {
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'Password123!'
            };

            const { user, tokens } = await register(userData);
            const result = await refreshToken(tokens.refreshToken);

            expect(result.user).toHaveProperty('id');
            expect(result.user.username).toBe('testuser');
            expect(result.tokens).toHaveProperty('accessToken');
            expect(result.tokens).toHaveProperty('refreshToken');
            expect(result.tokens.refreshToken).not.toBe(tokens.refreshToken);

            const storedToken = await redisClient.get(`refresh_token:${user.id}`);
            expect(storedToken).toBe(result.tokens.refreshToken);
        });

        it('should throw error for invalid refresh token', async () => {
            await expect(refreshToken('invalid-token')).rejects.toThrow('Invalid refresh token');
        });
    });

    describe('setup2FA', () => {
        it('should set up 2FA and store secret in Redis', async () => {
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'Password123!'
            };

            const { user } = await register(userData);
            const result = await setup2FA(user.id);

            expect(result).toHaveProperty('otpauth');
            expect(result).toHaveProperty('secret');

            // Verify secret is stored in Redis
            const storedSecret = await redisClient.get(`2fa_setup:${user.id}`);
            expect(storedSecret).toBe(result.secret);

            // Verify user.twoFactorSecret is not set yet
            const dbUser = await User.findById(user.id).select('+twoFactorSecret');
            expect(dbUser).not.toBeNull();
            expect(dbUser.twoFactorSecret).not.toBeDefined();
            expect(dbUser.twoFactorEnabled).toBe(false);
        });

        it('should throw error if 2FA is already enabled', async () => {
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'Password123!'
            };

            const { user } = await register(userData);
            await User.findByIdAndUpdate(user.id, {
                twoFactorSecret: authenticator.generateSecret(),
                twoFactorEnabled: true
            });

            await expect(setup2FA(user.id)).rejects.toThrow('2FA is already enabled');
        });

        it('should throw error if user not found', async () => {
            const invalidId = new mongoose.Types.ObjectId().toString();
            await expect(setup2FA(invalidId)).rejects.toThrow('User not found');
        });
    });
});