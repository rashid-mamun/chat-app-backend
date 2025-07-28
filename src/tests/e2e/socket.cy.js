const io = require('socket.io-client');
const request = require('supertest');
const app = require('../../../server'); // Adjust path if necessary
const User = require('../../models/User');
const Message = require('../../models/Message');
const Group = require('../../models/Group');

describe('Socket.IO Chat', () => {
    let user1, user2, group, token1, token2;

    beforeEach(async () => {
        await User.deleteMany({});
        await Message.deleteMany({});
        await Group.deleteMany({});

        // Create test users
        const user1Data = {
            username: 'user1',
            email: 'user1@example.com',
            password: 'Test123!@#'
        };
        const user2Data = {
            username: 'user2',
            email: 'user2@example.com',
            password: 'Test123!@#'
        };

        const user1Response = await request(app)
            .post('/api/v1/auth/register')
            .send(user1Data);
        const user2Response = await request(app)
            .post('/api/v1/auth/register')
            .send(user2Data);

        user1 = await User.findOne({ email: user1Data.email });
        user2 = await User.findOne({ email: user2Data.email });
        token1 = user1Response.body.data.tokens.accessToken;
        token2 = user2Response.body.data.tokens.accessToken;

        // Create test group
        group = await Group.create({
            name: 'Test Group',
            members: [user1._id, user2._id],
            admins: [user1._id]
        });
    });

    it('should send and receive private messages', (done) => {
        const socket1 = io('http://localhost:5000', { auth: { token: token1 } });
        const socket2 = io('http://localhost:5000', { auth: { token: token2 } });

        socket1.on('connect', () => {
            socket1.emit('joinPrivateChat', { recipientId: user2._id.toString() });
        });

        socket2.on('connect', () => {
            socket2.emit('joinPrivateChat', { recipientId: user1._id.toString() });
        });

        socket2.on('newPrivateMessage', (message) => {
            expect(message.content).toBe('Hello from user1');
            expect(message.sender._id).toBe(user1._id.toString());
            socket1.disconnect();
            socket2.disconnect();
            done();
        });

        socket1.on('joinedPrivateChat', () => {
            socket1.emit('sendPrivateMessage', {
                recipientId: user2._id.toString(),
                content: 'Hello from user1'
            });
        });
    });

    it('should send and receive group messages', (done) => {
        const socket1 = io('http://localhost:5000', { auth: { token: token1 } });
        const socket2 = io('http://localhost:5000', { auth: { token: token2 } });

        socket1.on('connect', () => {
            socket1.emit('joinGroupChat', { groupId: group._id.toString() });
        });

        socket2.on('connect', () => {
            socket2.emit('joinGroupChat', { groupId: group._id.toString() });
        });

        socket2.on('newGroupMessage', (message) => {
            expect(message.content).toBe('Group message');
            expect(message.sender._id).toBe(user1._id.toString());
            socket1.disconnect();
            socket2.disconnect();
            done();
        });

        socket1.on('joinedGroupChat', () => {
            socket1.emit('sendGroupMessage', {
                groupId: group._id.toString(),
                content: 'Group message'
            });
        });
    });

    it('should add and broadcast message reactions', (done) => {
        const socket1 = io('http://localhost:5000', { auth: { token: token1 } });
        const socket2 = io('http://localhost:5000', { auth: { token: token2 } });

        socket1.on('connect', async () => {
            socket1.emit('joinPrivateChat', { recipientId: user2._id.toString() });

            const message = await Message.create({
                sender: user1._id,
                recipient: user2._id,
                content: 'Test message',
                chatType: 'private'
            });

            socket1.emit('addReaction', {
                messageId: message._id.toString(),
                reaction: 'like'
            });
        });

        socket2.on('messageReactionAdded', (data) => {
            expect(data.messageId).toBeDefined();
            expect(data.reaction).toBe('like');
            expect(data.userId).toBe(user1._id.toString());
            socket1.disconnect();
            socket2.disconnect();
            done();
        });
    });

    it('should pin messages and broadcast event', async () => {
        const socket1 = io('http://localhost:5000', { auth: { token: token1 } });
        const socket2 = io('http://localhost:5000', { auth: { token: token2 } });

        const message = await Message.create({
            sender: user1._id,
            group: group._id,
            content: 'Group message',
            chatType: 'group'
        });

        socket1.on('connect', () => {
            socket1.emit('joinGroupChat', { groupId: group._id.toString() });
        });

        socket2.on('connect', () => {
            socket2.emit('joinGroupChat', { groupId: group._id.toString() });
        });

        await new Promise((resolve) => {
            socket1.on('joinedGroupChat', async () => {
                await request(app)
                    .post(`/api/v1/chat/messages/${message._id}/pin`)
                    .set('Authorization', `Bearer ${token1}`)
                    .expect(200);
                resolve();
            });
        });

        await new Promise((resolve) => {
            socket2.on('messagePinned', (data) => {
                expect(data.messageId).toBe(message._id.toString());
                expect(data.pinnedBy).toBe(user1._id.toString());
                socket1.disconnect();
                socket2.disconnect();
                resolve();
            });
        });
    });
});