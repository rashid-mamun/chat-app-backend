const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../server');
const User = require('../../models/User');
const { authenticator } = require('otplib');
const { redisClient } = require('../../config/redis');
const bcrypt = require('bcryptjs');

// Disable rate limiting for tests
jest.mock('../../middleware/rateLimiter', () => ({
    rateLimiters: {
        auth: (req, res, next) => next(),
        messages: (req, res, next) => next()
    }
}));

describe('Auth Controller', () => {
    let testUser, testUser2, accessToken, refreshToken;

    beforeEach(async () => {
        await User.deleteMany({});
        await redisClient.flushAll();
    });

    describe('POST /api/v1/auth/register', () => {
        const validUserData = {
            username: 'testuser',
            email: 'test@example.com',
            password: 'Test123!@#'
        };

        it('should register a new user successfully', async () => {
            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(validUserData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('User registered successfully');
            expect(response.body.data.user.username).toBe(validUserData.username);
            expect(response.body.data.user.email).toBe(validUserData.email);
            expect(response.body.data.tokens.accessToken).toBeDefined();
            expect(response.body.data.tokens.refreshToken).toBeDefined();

            const user = await User.findOne({ email: validUserData.email });
            expect(user).toBeDefined();
            expect(user.username).toBe(validUserData.username);
            expect(user.password).not.toBe(validUserData.password); // Should be hashed
        });

        it('should return validation error for invalid email', async () => {
            const invalidData = { ...validUserData, email: 'invalid-email' };

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(invalidData)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Validation failed');
            expect(response.body.errors).toBeDefined();
        });

        it('should return validation error for weak password', async () => {
            const weakPasswordData = { ...validUserData, password: 'weak' };

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(weakPasswordData)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Validation failed');
        });

        it('should return error for duplicate email', async () => {
            await User.create(validUserData);

            const duplicateData = { ...validUserData, username: 'testuser2' };

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(duplicateData)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('User already exists');
        });

        it('should return error for duplicate username', async () => {
            await User.create(validUserData);

            const duplicateData = { ...validUserData, email: 'test2@example.com' };

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(duplicateData)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Username already taken');
        });
    });

    describe('POST /api/v1/auth/login', () => {
        beforeEach(async () => {
            testUser = await User.create({
                username: 'testuser',
                email: 'test@example.com',
                password: 'Test123!@#'
            });
        });

        it('should login successfully with valid credentials', async () => {
            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'Test123!@#'
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Login successful');
            expect(response.body.data.user.email).toBe('test@example.com');
            expect(response.body.data.tokens.accessToken).toBeDefined();
            expect(response.body.data.tokens.refreshToken).toBeDefined();

            accessToken = response.body.data.tokens.accessToken;
            refreshToken = response.body.data.tokens.refreshToken;
        });

        it('should return error for invalid email', async () => {
            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'nonexistent@example.com',
                    password: 'Test123!@#'
                })
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Invalid credentials');
        });

        it('should return error for invalid password', async () => {
            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'wrongpassword'
                })
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Invalid credentials');
        });

        it('should require 2FA token when enabled', async () => {
            const secret = authenticator.generateSecret();
            testUser2 = await User.create({
                username: 'testuser2',
                email: 'test2@example.com',
                password: 'Test123!@#',
                twoFactorSecret: secret,
                twoFactorEnabled: true
            });

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'test2@example.com',
                    password: 'Test123!@#'
                })
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('2FA token required');

            const user = await User.findOne({ email: 'test2@example.com' }).select('+twoFactorSecret');
            const twoFactorToken = authenticator.generate(user.twoFactorSecret);

            const loginResponse = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'test2@example.com',
                    password: 'Test123!@#',
                    twoFactorToken
                })
                .expect(200);

            expect(loginResponse.body.success).toBe(true);
            expect(loginResponse.body.data.user.email).toBe('test2@example.com');
        });

        it('should return error for invalid 2FA token', async () => {
            const secret = authenticator.generateSecret();
            testUser2 = await User.create({
                username: 'testuser2',
                email: 'test2@example.com',
                password: 'Test123!@#',
                twoFactorSecret: secret,
                twoFactorEnabled: true
            });

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'test2@example.com',
                    password: 'Test123!@#',
                    twoFactorToken: '123456'
                })
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Invalid 2FA token');
        });
    });

    describe('POST /api/v1/auth/logout', () => {
        beforeEach(async () => {
            testUser = await User.create({
                username: 'testuser',
                email: 'test@example.com',
                password: 'Test123!@#'
            });

            const loginResponse = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'Test123!@#'
                });

            accessToken = loginResponse.body.data.tokens.accessToken;
        });

        it('should logout successfully with valid token', async () => {
            const response = await request(app)
                .post('/api/v1/auth/logout')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Logout successful');
        });

        it('should return error without token', async () => {
            const response = await request(app)
                .post('/api/v1/auth/logout')
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Access token is required');
        });

        it('should return error with invalid token', async () => {
            const response = await request(app)
                .post('/api/v1/auth/logout')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Invalid token');
        });
    });

    describe('POST /api/v1/auth/refresh-token', () => {
        beforeEach(async () => {
            testUser = await User.create({
                username: 'testuser',
                email: 'test@example.com',
                password: 'Test123!@#'
            });

            const loginResponse = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'Test123!@#'
                });

            refreshToken = loginResponse.body.data.tokens.refreshToken;
        });

        it('should refresh token successfully', async () => {
            const response = await request(app)
                .post('/api/v1/auth/refresh-token')
                .send({ refreshToken })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.tokens.accessToken).toBeDefined();
            expect(response.body.data.tokens.refreshToken).toBeDefined();
            expect(response.body.data.user.email).toBe('test@example.com');
        });

        it('should return error for invalid refresh token', async () => {
            const response = await request(app)
                .post('/api/v1/auth/refresh-token')
                .send({ refreshToken: 'invalid-token' })
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Invalid refresh token');
        });

        it('should return error for missing refresh token', async () => {
            const response = await request(app)
                .post('/api/v1/auth/refresh-token')
                .send({})
                .expect(401);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/v1/auth/2fa/setup', () => {
        beforeEach(async () => {
            testUser = await User.create({
                username: 'testuser',
                email: 'test@example.com',
                password: 'Test123!@#'
            });

            const loginResponse = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'Test123!@#'
                });

            accessToken = loginResponse.body.data.tokens.accessToken;
        });

        it('should setup 2FA successfully', async () => {
            const response = await request(app)
                .post('/api/v1/auth/2fa/setup')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.qrCode).toBeDefined();
            expect(response.body.data.secret).toBeDefined();
        });

        it('should return error if 2FA is already enabled', async () => {
            const secret = authenticator.generateSecret();
            await User.findByIdAndUpdate(testUser._id, {
                twoFactorSecret: secret,
                twoFactorEnabled: true
            });

            const response = await request(app)
                .post('/api/v1/auth/2fa/setup')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('2FA is already enabled');
        });

        it('should return error without authentication', async () => {
            const response = await request(app)
                .post('/api/v1/auth/2fa/setup')
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Access token is required');
        });
    });

    describe('POST /api/v1/auth/2fa/verify', () => {
        beforeEach(async () => {
            testUser = await User.create({
                username: 'testuser',
                email: 'test@example.com',
                password: 'Test123!@#'
            });

            const loginResponse = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'Test123!@#'
                });

            accessToken = loginResponse.body.data.tokens.accessToken;

            // Setup 2FA
            await request(app)
                .post('/api/v1/auth/2fa/setup')
                .set('Authorization', `Bearer ${accessToken}`);
        });

        it('should verify 2FA successfully', async () => {
            // Setup 2FA first
            await request(app)
                .post('/api/v1/auth/2fa/setup')
                .set('Authorization', `Bearer ${accessToken}`);

            const secret = await redisClient.get(`2fa_setup:${testUser._id}`);
            const token = authenticator.generate(secret);

            const response = await request(app)
                .post('/api/v1/auth/2fa/verify')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ token })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('2FA enabled successfully');

            const user = await User.findById(testUser._id);
            expect(user.twoFactorEnabled).toBe(true);
        });

        it('should return error for invalid token', async () => {
            // Setup 2FA first
            await request(app)
                .post('/api/v1/auth/2fa/setup')
                .set('Authorization', `Bearer ${accessToken}`);

            const response = await request(app)
                .post('/api/v1/auth/2fa/verify')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ token: '123456' })
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Invalid 2FA token');
        });

        it('should return error without authentication', async () => {
            const response = await request(app)
                .post('/api/v1/auth/2fa/verify')
                .send({ token: '123456' })
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Access token is required');
        });
    });

    describe('GET /api/v1/auth/profile', () => {
        beforeEach(async () => {
            testUser = await User.create({
                username: 'testuser',
                email: 'test@example.com',
                password: 'Test123!@#',
                avatar: 'avatar.jpg'
            });

            const loginResponse = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'Test123!@#'
                });

            accessToken = loginResponse.body.data.tokens.accessToken;
        });

        it('should get user profile successfully', async () => {
            const response = await request(app)
                .get('/api/v1/auth/profile')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.username).toBe('testuser');
            expect(response.body.data.email).toBe('test@example.com');
            expect(response.body.data.avatar).toBe('avatar.jpg');
            expect(response.body.data.password).toBeUndefined();
            expect(response.body.data.twoFactorSecret).toBeUndefined();
        });

        it('should return error without authentication', async () => {
            const response = await request(app)
                .get('/api/v1/auth/profile')
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Access token is required');
        });
    });

    describe('PUT /api/v1/auth/profile', () => {
        beforeEach(async () => {
            testUser = await User.create({
                username: 'testuser',
                email: 'test@example.com',
                password: 'Test123!@#'
            });

            const loginResponse = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'Test123!@#'
                });

            accessToken = loginResponse.body.data.tokens.accessToken;
        });

        it('should update username successfully', async () => {
            const response = await request(app)
                .put('/api/v1/auth/profile')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ username: 'newusername' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Profile updated successfully');
            expect(response.body.data.username).toBe('newusername');
        });

        it('should update avatar successfully', async () => {
            const response = await request(app)
                .put('/api/v1/auth/profile')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ avatar: 'new-avatar.jpg' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.avatar).toBe('new-avatar.jpg');
        });

        it('should return error for duplicate username', async () => {
            await User.create({
                username: 'existinguser',
                email: 'existing@example.com',
                password: 'Test123!@#'
            });

            const response = await request(app)
                .put('/api/v1/auth/profile')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ username: 'existinguser' })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Username already taken');
        });

        it('should return error without authentication', async () => {
            const response = await request(app)
                .put('/api/v1/auth/profile')
                .send({ username: 'newusername' })
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Access token is required');
        });
    });

    describe('PUT /api/v1/auth/change-password', () => {
        beforeEach(async () => {
            testUser = await User.create({
                username: 'testuser',
                email: 'test@example.com',
                password: 'Test123!@#'
            });

            const loginResponse = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'Test123!@#'
                });

            accessToken = loginResponse.body.data.tokens.accessToken;
        });

        it('should change password successfully', async () => {
            const response = await request(app)
                .put('/api/v1/auth/change-password')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                    currentPassword: 'Test123!@#',
                    newPassword: 'NewTest123!@#'
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Password changed successfully');

            // Verify new password works
            const loginResponse = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'NewTest123!@#'
                })
                .expect(200);

            expect(loginResponse.body.success).toBe(true);
        });

        it('should return error for incorrect current password', async () => {
            const response = await request(app)
                .put('/api/v1/auth/change-password')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                    currentPassword: 'WrongPassword123!@#',
                    newPassword: 'NewTest123!@#'
                })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Current password is incorrect');
        });

        it('should return error for weak new password', async () => {
            const response = await request(app)
                .put('/api/v1/auth/change-password')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                    currentPassword: 'Test123!@#',
                    newPassword: 'weak'
                })
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should return error without authentication', async () => {
            const response = await request(app)
                .put('/api/v1/auth/change-password')
                .send({
                    currentPassword: 'Test123!@#',
                    newPassword: 'NewTest123!@#'
                })
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Access token is required');
        });
    });
});