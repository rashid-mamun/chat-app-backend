const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../server');
const User = require('../../models/User');
const Group = require('../../models/Group');
const bcrypt = require('bcryptjs');

// Mock rate limiters for tests
jest.mock('../../middleware/rateLimiter', () => ({
    rateLimiters: {
        auth: (req, res, next) => next(),
        messages: (req, res, next) => next()
    }
}));

describe('Group Controller', () => {
    let user1, user2, user3, group1, accessToken1, accessToken2, accessToken3;

    beforeEach(async () => {
        await User.deleteMany({});
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

    describe('POST /api/v1/group', () => {
        it('should create a new group successfully', async () => {
            const groupData = {
                name: 'Test Group',
                members: [user2._id.toString()]
            };

            const response = await request(app)
                .post('/api/v1/group')
                .set('Authorization', `Bearer ${accessToken1}`)
                .send(groupData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Group created successfully');
            expect(response.body.data.name).toBe('Test Group');
            expect(response.body.data.members).toHaveLength(2); // creator + member
            expect(response.body.data.admins).toHaveLength(1);
            expect(response.body.data.members.map(m => m._id.toString())).toContain(user1._id.toString());
            expect(response.body.data.members.map(m => m._id.toString())).toContain(user2._id.toString());
        });

        it('should return error for missing group name', async () => {
            const groupData = {
                members: [user2._id.toString()]
            };

            const response = await request(app)
                .post('/api/v1/group')
                .set('Authorization', `Bearer ${accessToken1}`)
                .send(groupData)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Group name and members array are required');
        });

        it('should return error for missing members array', async () => {
            const groupData = {
                name: 'Test Group'
            };

            const response = await request(app)
                .post('/api/v1/group')
                .set('Authorization', `Bearer ${accessToken1}`)
                .send(groupData)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Group name and members array are required');
        });

        it('should return error for non-existent member', async () => {
            const fakeUserId = new mongoose.Types.ObjectId();
            const groupData = {
                name: 'Test Group',
                members: [fakeUserId.toString()]
            };

            const response = await request(app)
                .post('/api/v1/group')
                .set('Authorization', `Bearer ${accessToken1}`)
                .send(groupData)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('One or more members not found');
        });

        it('should return error without authentication', async () => {
            const groupData = {
                name: 'Test Group',
                members: [user2._id.toString()]
            };

            const response = await request(app)
                .post('/api/v1/group')
                .send(groupData)
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Access token is required');
        });
    });

    describe('GET /api/v1/group', () => {
        beforeEach(async () => {
            // Create test groups
            group1 = await Group.create({
                name: 'Group 1',
                members: [user1._id, user2._id],
                admins: [user1._id]
            });

            await Group.create({
                name: 'Group 2',
                members: [user1._id, user3._id],
                admins: [user1._id]
            });

            await Group.create({
                name: 'Group 3',
                members: [user2._id, user3._id],
                admins: [user2._id]
            });
        });

        it('should get user\'s groups successfully', async () => {
            const response = await request(app)
                .get('/api/v1/group')
                .set('Authorization', `Bearer ${accessToken1}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(2); // user1 is in 2 groups
            expect(response.body.data[0].name).toBeDefined();
            expect(response.body.data[0].members).toBeDefined();
            expect(response.body.data[0].admins).toBeDefined();
        });

        it('should return empty array for user with no groups', async () => {
            // Create a new user that has no groups
            const user4 = await User.create({
                username: 'user4',
                email: 'user4@example.com',
                password: 'Test123!@#'
            });

            const login4 = await request(app)
                .post('/api/v1/auth/login')
                .send({ email: 'user4@example.com', password: 'Test123!@#' });
            const accessToken4 = login4.body.data.tokens.accessToken;

            const response = await request(app)
                .get('/api/v1/group')
                .set('Authorization', `Bearer ${accessToken4}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(0);
        });

        it('should return error without authentication', async () => {
            const response = await request(app)
                .get('/api/v1/group')
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Access token is required');
        });
    });

    describe('GET /api/v1/group/:groupId', () => {
        beforeEach(async () => {
            group1 = await Group.create({
                name: 'Test Group',
                members: [user1._id, user2._id],
                admins: [user1._id]
            });
        });

        it('should get group details for member', async () => {
            const response = await request(app)
                .get(`/api/v1/group/${group1._id}`)
                .set('Authorization', `Bearer ${accessToken1}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe('Test Group');
            expect(response.body.data.members).toHaveLength(2);
            expect(response.body.data.admins).toHaveLength(1);
        });

        it('should return error for non-member', async () => {
            const response = await request(app)
                .get(`/api/v1/group/${group1._id}`)
                .set('Authorization', `Bearer ${accessToken3}`)
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Access denied to group');
        });

        it('should return error for non-existent group', async () => {
            const fakeGroupId = new mongoose.Types.ObjectId();
            const response = await request(app)
                .get(`/api/v1/group/${fakeGroupId}`)
                .set('Authorization', `Bearer ${accessToken1}`)
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Group not found');
        });
    });

    describe('PUT /api/v1/group/:groupId', () => {
        beforeEach(async () => {
            group1 = await Group.create({
                name: 'Original Group Name',
                members: [user1._id, user2._id],
                admins: [user1._id]
            });
        });

        it('should update group name by admin', async () => {
            const response = await request(app)
                .put(`/api/v1/group/${group1._id}`)
                .set('Authorization', `Bearer ${accessToken1}`)
                .send({ name: 'Updated Group Name' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Group updated successfully');
            expect(response.body.data.name).toBe('Updated Group Name');
        });

        it('should return error for non-admin', async () => {
            const response = await request(app)
                .put(`/api/v1/group/${group1._id}`)
                .set('Authorization', `Bearer ${accessToken2}`)
                .send({ name: 'Updated Group Name' })
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Only group admins can update group');
        });

        it('should return error for non-existent group', async () => {
            const fakeGroupId = new mongoose.Types.ObjectId();
            const response = await request(app)
                .put(`/api/v1/group/${fakeGroupId}`)
                .set('Authorization', `Bearer ${accessToken1}`)
                .send({ name: 'Updated Group Name' })
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Group not found');
        });
    });

    describe('DELETE /api/v1/group/:groupId', () => {
        beforeEach(async () => {
            group1 = await Group.create({
                name: 'Test Group',
                members: [user1._id, user2._id],
                admins: [user1._id]
            });
        });

        it('should delete group by admin', async () => {
            const response = await request(app)
                .delete(`/api/v1/group/${group1._id}`)
                .set('Authorization', `Bearer ${accessToken1}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Group deleted successfully');

            const deletedGroup = await Group.findById(group1._id);
            expect(deletedGroup).toBeNull();
        });

        it('should return error for non-admin', async () => {
            const response = await request(app)
                .delete(`/api/v1/group/${group1._id}`)
                .set('Authorization', `Bearer ${accessToken2}`)
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Only group admins can delete group');
        });

        it('should return error for non-existent group', async () => {
            const fakeGroupId = new mongoose.Types.ObjectId();
            const response = await request(app)
                .delete(`/api/v1/group/${fakeGroupId}`)
                .set('Authorization', `Bearer ${accessToken1}`)
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Group not found');
        });
    });

    describe('POST /api/v1/group/:groupId/members', () => {
        beforeEach(async () => {
            group1 = await Group.create({
                name: 'Test Group',
                members: [user1._id],
                admins: [user1._id]
            });
        });

        it('should add member successfully by admin', async () => {
            const response = await request(app)
                .post(`/api/v1/group/${group1._id}/members`)
                .set('Authorization', `Bearer ${accessToken1}`)
                .send({ memberId: user2._id.toString() })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Member added successfully');
            expect(response.body.data.members).toHaveLength(2);
            expect(response.body.data.members.map(m => m._id.toString())).toContain(user2._id.toString());
        });

        it('should return error for non-admin', async () => {
            const response = await request(app)
                .post(`/api/v1/group/${group1._id}/members`)
                .set('Authorization', `Bearer ${accessToken2}`)
                .send({ memberId: user3._id.toString() })
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Only group admins can add members');
        });

        it('should return error for already existing member', async () => {
            // First add the member
            await request(app)
                .post(`/api/v1/group/${group1._id}/members`)
                .set('Authorization', `Bearer ${accessToken1}`)
                .send({ memberId: user2._id.toString() });

            // Try to add again
            const response = await request(app)
                .post(`/api/v1/group/${group1._id}/members`)
                .set('Authorization', `Bearer ${accessToken1}`)
                .send({ memberId: user2._id.toString() })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('User is already a member of this group');
        });

        it('should return error for non-existent user', async () => {
            const fakeUserId = new mongoose.Types.ObjectId();
            const response = await request(app)
                .post(`/api/v1/group/${group1._id}/members`)
                .set('Authorization', `Bearer ${accessToken1}`)
                .send({ memberId: fakeUserId.toString() })
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('User not found');
        });
    });

    describe('DELETE /api/v1/group/:groupId/members/:memberId', () => {
        beforeEach(async () => {
            group1 = await Group.create({
                name: 'Test Group',
                members: [user1._id, user2._id],
                admins: [user1._id]
            });
        });

        it('should remove member successfully by admin', async () => {
            const response = await request(app)
                .delete(`/api/v1/group/${group1._id}/members/${user2._id}`)
                .set('Authorization', `Bearer ${accessToken1}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Member removed successfully');
            expect(response.body.data.members).toHaveLength(1);
            expect(response.body.data.members.map(m => m._id.toString())).not.toContain(user2._id.toString());
        });

        it('should return error for non-admin', async () => {
            const response = await request(app)
                .delete(`/api/v1/group/${group1._id}/members/${user3._id}`)
                .set('Authorization', `Bearer ${accessToken2}`)
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Only group admins can remove members');
        });

        it('should return error when trying to remove self', async () => {
            const response = await request(app)
                .delete(`/api/v1/group/${group1._id}/members/${user1._id}`)
                .set('Authorization', `Bearer ${accessToken1}`)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('You cannot remove yourself from the group');
        });
    });

    describe('POST /api/v1/group/:groupId/admins', () => {
        beforeEach(async () => {
            group1 = await Group.create({
                name: 'Test Group',
                members: [user1._id, user2._id],
                admins: [user1._id]
            });
        });

        it('should add admin successfully by existing admin', async () => {
            const response = await request(app)
                .post(`/api/v1/group/${group1._id}/admins`)
                .set('Authorization', `Bearer ${accessToken1}`)
                .send({ adminId: user2._id.toString() })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Admin added successfully');
            expect(response.body.data.admins).toHaveLength(2);
            expect(response.body.data.admins.map(a => a._id.toString())).toContain(user2._id.toString());
        });

        it('should return error for non-admin', async () => {
            const response = await request(app)
                .post(`/api/v1/group/${group1._id}/admins`)
                .set('Authorization', `Bearer ${accessToken2}`)
                .send({ adminId: user3._id.toString() })
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Only group admins can add admins');
        });

        it('should return error for non-member', async () => {
            const response = await request(app)
                .post(`/api/v1/group/${group1._id}/admins`)
                .set('Authorization', `Bearer ${accessToken1}`)
                .send({ adminId: user3._id.toString() })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('User must be a member of the group to become admin');
        });

        it('should return error for already existing admin', async () => {
            const response = await request(app)
                .post(`/api/v1/group/${group1._id}/admins`)
                .set('Authorization', `Bearer ${accessToken1}`)
                .send({ adminId: user1._id.toString() })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('User is already an admin of this group');
        });
    });

    describe('DELETE /api/v1/group/:groupId/admins/:adminId', () => {
        beforeEach(async () => {
            group1 = await Group.create({
                name: 'Test Group',
                members: [user1._id, user2._id],
                admins: [user1._id, user2._id]
            });
        });

        it('should remove admin successfully by another admin', async () => {
            const response = await request(app)
                .delete(`/api/v1/group/${group1._id}/admins/${user2._id}`)
                .set('Authorization', `Bearer ${accessToken1}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Admin removed successfully');
            expect(response.body.data.admins).toHaveLength(1);
            expect(response.body.data.admins.map(a => a._id.toString())).not.toContain(user2._id.toString());
        });

        it('should return error for non-admin', async () => {
            const response = await request(app)
                .delete(`/api/v1/group/${group1._id}/admins/${user1._id}`)
                .set('Authorization', `Bearer ${accessToken3}`)
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Only group admins can remove admins');
        });

        it('should return error when trying to remove self as admin', async () => {
            const response = await request(app)
                .delete(`/api/v1/group/${group1._id}/admins/${user1._id}`)
                .set('Authorization', `Bearer ${accessToken1}`)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('You cannot remove yourself as admin');
        });
    });
}); 