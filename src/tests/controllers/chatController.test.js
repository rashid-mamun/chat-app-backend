const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../server');
const User = require('../../models/User');
const Message = require('../../models/Message');
const Group = require('../../models/Group');
const bcrypt = require('bcryptjs');
const path = require('path');

// Mock rate limiters for tests
jest.mock('../../middleware/rateLimiter', () => ({
    rateLimiters: {
        auth: (req, res, next) => next(),
        messages: (req, res, next) => next()
    }
}));

describe('Chat Controller', () => {
    let user1, user2, user3, group1, accessToken1, accessToken2, accessToken3;

    beforeEach(async () => {
        await User.deleteMany({});
        await Message.deleteMany({});
        await Group.deleteMany({});

        // Create test users (let User model handle password hashing)
        user1 = await User.create({
            username: 'user1',
            email: 'user1@example.com',
            password: 'Test123!@#'
        });
        user2 = await User.create({
            username: 'user2',
            email: 'user2@example.com',
            password: 'Test123!@#'
        });
        user3 = await User.create({
            username: 'user3',
            email: 'user3@example.com',
            password: 'Test123!@#'
        });

        // Create test group
        group1 = await Group.create({
            name: 'Test Group',
            members: [user1._id, user2._id],
            admins: [user1._id]
        });

        // Login users
        const login1 = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'user1@example.com', password: 'Test123!@#' });
        accessToken1 = login1.body.data.tokens.accessToken;

        const login2 = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'user2@example.com', password: 'Test123!@#' });
        accessToken2 = login2.body.data.tokens.accessToken;

        const login3 = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'user3@example.com', password: 'Test123!@#' });
        accessToken3 = login3.body.data.tokens.accessToken;
    });

    describe('GET /api/v1/chat/private/:recipientId', () => {
        beforeEach(async () => {
            // Create some private messages
            await Message.create([
                {
                    sender: user1._id,
                    recipient: user2._id,
                    content: 'Hello from user1',
                    chatType: 'private'
                },
                {
                    sender: user2._id,
                    recipient: user1._id,
                    content: 'Hello from user2',
                    chatType: 'private'
                },
                {
                    sender: user1._id,
                    recipient: user2._id,
                    content: 'Another message',
                    chatType: 'private'
                }
            ]);
        });

        it('should get private messages between two users', async () => {
            const response = await request(app)
                .get(`/api/v1/chat/private/${user2._id}`)
                .set('Authorization', `Bearer ${accessToken1}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(3);
            expect(response.body.data[0].content).toBeDefined();
            expect(response.body.data[0].sender).toBeDefined();
        });

        it('should return empty array if no messages exist', async () => {
            const response = await request(app)
                .get(`/api/v1/chat/private/${user3._id}`)
                .set('Authorization', `Bearer ${accessToken1}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(0);
        });

        it('should return error without authentication', async () => {
            const response = await request(app)
                .get(`/api/v1/chat/private/${user2._id}`)
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Access token is required');
        });

        it('should support pagination', async () => {
            const response = await request(app)
                .get(`/api/v1/chat/private/${user2._id}?page=1&limit=2`)
                .set('Authorization', `Bearer ${accessToken1}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(2);
        });
    });

    describe('GET /api/v1/chat/group/:groupId', () => {
        beforeEach(async () => {
            // Create some group messages
            await Message.create([
                {
                    sender: user1._id,
                    group: group1._id,
                    content: 'Hello group from user1',
                    chatType: 'group'
                },
                {
                    sender: user2._id,
                    group: group1._id,
                    content: 'Hello group from user2',
                    chatType: 'group'
                }
            ]);
        });

        it('should get group messages for authorized user', async () => {
            const response = await request(app)
                .get(`/api/v1/chat/group/${group1._id}`)
                .set('Authorization', `Bearer ${accessToken1}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(2);
            expect(response.body.data[0].content).toBeDefined();
            expect(response.body.data[0].sender).toBeDefined();
        });

        it('should throw error for unauthorized group access', async () => {
            const response = await request(app)
                .get(`/api/v1/chat/group/${group1._id}`)
                .set('Authorization', `Bearer ${accessToken3}`)
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Access denied to group');
        });

        it('should return error for non-existent group', async () => {
            const fakeGroupId = new mongoose.Types.ObjectId();
            const response = await request(app)
                .get(`/api/v1/chat/group/${fakeGroupId}`)
                .set('Authorization', `Bearer ${accessToken1}`)
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Access denied to group');
        });
    });

    describe('GET /api/v1/chat/user', () => {
        beforeEach(async () => {
            // Create messages for different chats
            await Message.create([
                {
                    sender: user1._id,
                    recipient: user2._id,
                    content: 'Private message',
                    chatType: 'private'
                },
                {
                    sender: user1._id,
                    group: group1._id,
                    content: 'Group message',
                    chatType: 'group'
                }
            ]);
        });

        it('should retrieve user\'s private and group chats', async () => {
            const response = await request(app)
                .get('/api/v1/chat/user')
                .set('Authorization', `Bearer ${accessToken1}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.privateChats).toBeDefined();
            expect(response.body.data.groupChats).toBeDefined();
            expect(response.body.data.privateChats).toHaveLength(1);
            expect(response.body.data.groupChats).toHaveLength(1);
        });

        it('should return error without authentication', async () => {
            const response = await request(app)
                .get('/api/v1/chat/user')
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Access token is required');
        });
    });

    describe('GET /api/v1/chat/messages/search', () => {
        beforeEach(async () => {
            await Message.create([
                {
                    sender: user1._id,
                    recipient: user2._id,
                    content: 'Hello world message',
                    chatType: 'private'
                },
                {
                    sender: user1._id,
                    group: group1._id,
                    content: 'Group hello message',
                    chatType: 'group'
                }
            ]);
        });

        it('should search private messages by content', async () => {
            // Create a specific message for this test
            const message = await Message.create({
                sender: user1._id,
                recipient: user2._id,
                content: 'Unique search test message',
                chatType: 'private'
            });

            // Ensure the message is saved
            await message.save();

            const response = await request(app)
                .get('/api/v1/chat/messages/search')
                .query({
                    query: 'Unique search',
                    chatType: 'private',
                    chatId: user2._id.toString()
                })
                .set('Authorization', `Bearer ${accessToken1}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(1);
            expect(response.body.data[0].content).toContain('Unique search');
        });

        it('should search group messages by content', async () => {
            // Create a specific group for this test
            const testGroup = await Group.create({
                name: 'Test Group for Search',
                members: [user1._id, user2._id],
                admins: [user1._id]
            });

            // Create a specific message for this test
            const message = await Message.create({
                sender: user1._id,
                group: testGroup._id,
                content: 'Group hello message',
                chatType: 'group'
            });

            // Ensure the message is saved
            await message.save();

            const response = await request(app)
                .get('/api/v1/chat/messages/search')
                .query({
                    query: 'Group',
                    chatType: 'group',
                    chatId: testGroup._id.toString()
                })
                .set('Authorization', `Bearer ${accessToken1}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(1);
            expect(response.body.data[0].content).toContain('Group');
        });

        it('should return empty array for no matches', async () => {
            const response = await request(app)
                .get('/api/v1/chat/messages/search')
                .query({
                    query: 'nonexistent',
                    chatType: 'private',
                    chatId: user2._id.toString()
                })
                .set('Authorization', `Bearer ${accessToken1}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(0);
        });
    });

    describe('GET /api/v1/chat/messages/search/advanced', () => {
        it('should search messages with advanced filters', async () => {
            // Create a specific message for this test
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            const message = await Message.create({
                sender: user1._id,
                recipient: user2._id,
                content: 'Yesterday message',
                chatType: 'private',
                createdAt: yesterday
            });

            // Ensure the message is saved
            await message.save();

            const response = await request(app)
                .get('/api/v1/chat/messages/search/advanced')
                .query({
                    query: 'Yesterday',
                    chatType: 'private',
                    chatId: user2._id.toString(),
                    startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                    endDate: new Date().toISOString()
                })
                .set('Authorization', `Bearer ${accessToken1}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.messages).toHaveLength(1);
            expect(response.body.data.total).toBe(1);
            expect(response.body.data.page).toBe(1);
            expect(response.body.data.messages[0].content).toContain('Yesterday');
        });

        it('should filter by file type', async () => {
            // Create a specific group for this test
            const testGroup = await Group.create({
                name: 'Test Group for Advanced Search',
                members: [user1._id, user2._id],
                admins: [user1._id]
            });

            // Create a specific message for this test
            const message = await Message.create({
                sender: user1._id,
                group: testGroup._id,
                content: 'Today message',
                chatType: 'group',
                fileType: 'image'
            });

            // Ensure the message is saved
            await message.save();

            const response = await request(app)
                .get('/api/v1/chat/messages/search/advanced')
                .query({
                    chatType: 'group',
                    chatId: testGroup._id.toString(),
                    fileType: 'image'
                })
                .set('Authorization', `Bearer ${accessToken1}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.messages).toHaveLength(1);
            expect(response.body.data.messages[0].fileType).toBe('image');
        });
    });

    describe('POST /api/v1/chat/messages/:messageId/pin', () => {
        let message;

        beforeEach(async () => {
            message = await Message.create({
                sender: user1._id,
                recipient: user2._id,
                content: 'Test message to pin',
                chatType: 'private'
            });
        });

        it('should pin a private message successfully', async () => {
            const response = await request(app)
                .post(`/api/v1/chat/messages/${message._id}/pin`)
                .set('Authorization', `Bearer ${accessToken1}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Message pinned successfully');

            const updatedMessage = await Message.findById(message._id);
            expect(updatedMessage.isPinned).toBe(true);
            expect(updatedMessage.pinnedBy.toString()).toBe(user1._id.toString());
        });

        it('should pin a group message by admin', async () => {
            const groupMessage = await Message.create({
                sender: user2._id,
                group: group1._id,
                content: 'Group message to pin',
                chatType: 'group'
            });

            const response = await request(app)
                .post(`/api/v1/chat/messages/${groupMessage._id}/pin`)
                .set('Authorization', `Bearer ${accessToken1}`)
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        it('should return error for non-admin trying to pin group message', async () => {
            const groupMessage = await Message.create({
                sender: user1._id,
                group: group1._id,
                content: 'Group message to pin',
                chatType: 'group'
            });

            const response = await request(app)
                .post(`/api/v1/chat/messages/${groupMessage._id}/pin`)
                .set('Authorization', `Bearer ${accessToken2}`)
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Only group admins can pin messages');
        });

        it('should return error for non-existent message', async () => {
            const fakeMessageId = new mongoose.Types.ObjectId();
            const response = await request(app)
                .post(`/api/v1/chat/messages/${fakeMessageId}/pin`)
                .set('Authorization', `Bearer ${accessToken1}`)
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Message not found');
        });

        it('should return error for unauthorized access', async () => {
            const response = await request(app)
                .post(`/api/v1/chat/messages/${message._id}/pin`)
                .set('Authorization', `Bearer ${accessToken3}`)
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Access denied');
        });
    });

    describe('DELETE /api/v1/chat/messages/:messageId', () => {
        let message;

        beforeEach(async () => {
            message = await Message.create({
                sender: user1._id,
                recipient: user2._id,
                content: 'Test message to delete',
                chatType: 'private'
            });
        });

        it('should delete own message successfully', async () => {
            const response = await request(app)
                .delete(`/api/v1/chat/messages/${message._id}`)
                .set('Authorization', `Bearer ${accessToken1}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Message deleted successfully');

            const deletedMessage = await Message.findById(message._id);
            expect(deletedMessage.isDeleted).toBe(true);
        });

        it('should return error when trying to delete another user\'s message', async () => {
            const response = await request(app)
                .delete(`/api/v1/chat/messages/${message._id}`)
                .set('Authorization', `Bearer ${accessToken2}`)
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('You can only delete your own messages');
        });

        it('should return error for non-existent message', async () => {
            const fakeMessageId = new mongoose.Types.ObjectId();
            const response = await request(app)
                .delete(`/api/v1/chat/messages/${fakeMessageId}`)
                .set('Authorization', `Bearer ${accessToken1}`)
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Message not found');
        });
    });

    describe('PUT /api/v1/chat/messages/:messageId', () => {
        let message;

        beforeEach(async () => {
            message = await Message.create({
                sender: user1._id,
                recipient: user2._id,
                content: 'Original message content',
                chatType: 'private'
            });
        });

        it('should edit own message successfully', async () => {
            const response = await request(app)
                .put(`/api/v1/chat/messages/${message._id}`)
                .set('Authorization', `Bearer ${accessToken1}`)
                .send({ content: 'Updated message content' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Message edited successfully');
            expect(response.body.data.content).toBe('Updated message content');
            expect(response.body.data.editedAt).toBeDefined();
        });

        it('should return error when trying to edit another user\'s message', async () => {
            const response = await request(app)
                .put(`/api/v1/chat/messages/${message._id}`)
                .set('Authorization', `Bearer ${accessToken2}`)
                .send({ content: 'Updated message content' })
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('You can only edit your own messages');
        });

        it('should return error for non-existent message', async () => {
            const fakeMessageId = new mongoose.Types.ObjectId();
            const response = await request(app)
                .put(`/api/v1/chat/messages/${fakeMessageId}`)
                .set('Authorization', `Bearer ${accessToken1}`)
                .send({ content: 'Updated message content' })
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Message not found');
        });

        it('should return validation error for empty content', async () => {
            const response = await request(app)
                .put(`/api/v1/chat/messages/${message._id}`)
                .set('Authorization', `Bearer ${accessToken1}`)
                .send({ content: '' })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Validation failed');
        });
    });

    describe('POST /api/v1/chat/upload', () => {
        it('should upload file successfully', async () => {
            const response = await request(app)
                .post('/api/v1/chat/upload')
                .set('Authorization', `Bearer ${accessToken1}`)
                .attach('file', path.join(__dirname, '../../../test-files/test.txt'))
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('File uploaded successfully');
            expect(response.body.data.fileName).toBe('test.txt');
            expect(response.body.data.fileUrl).toBeDefined();
            expect(response.body.data.fileSize).toBeDefined();
        });

        it('should return error when no file is uploaded', async () => {
            const response = await request(app)
                .post('/api/v1/chat/upload')
                .set('Authorization', `Bearer ${accessToken1}`)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('No file uploaded');
        });

        it('should return error without authentication', async () => {
            const response = await request(app)
                .post('/api/v1/chat/upload')
                .attach('file', path.join(__dirname, '../../../test-files/test.txt'))
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Access token is required');
        });
    });
});