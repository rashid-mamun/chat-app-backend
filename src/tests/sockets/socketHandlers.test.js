const { Server } = require('socket.io');
const { createServer } = require('http');
const Client = require('socket.io-client');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../../models/User');
const Message = require('../../models/Message');
const Group = require('../../models/Group');
const bcrypt = require('bcryptjs');

describe('Socket.IO Handlers', () => {
    let io, serverSocket, clientSocket, server, user1, user2, group1, token1, token2;

    beforeAll(async () => {
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

        // Create test group
        group1 = await Group.create({
            name: 'Test Group',
            members: [user1._id, user2._id],
            admins: [user1._id]
        });

        // Generate tokens
        token1 = jwt.sign({ id: user1._id, username: user1.username }, process.env.JWT_SECRET || 'test-secret');
        token2 = jwt.sign({ id: user2._id, username: user2.username }, process.env.JWT_SECRET || 'test-secret');
    }, 30000);

    beforeEach(async () => {
        await Message.deleteMany({});

        // Create HTTP server
        server = createServer();
        io = new Server(server);

        // Setup socket handlers
        const setupSocket = require('../../sockets/socketHandlers');
        await setupSocket(io);

        // Start server
        await new Promise((resolve) => server.listen(0, resolve));
        const port = server.address().port;

        // Create client connection
        clientSocket = Client(`http://localhost:${port}`, {
            auth: { token: token1 }
        });

        // Wait for connection
        await new Promise((resolve) => {
            clientSocket.on('connect', resolve);
        });

        // Get server socket
        serverSocket = io.sockets.sockets.get(clientSocket.id);
    }, 30000);

    afterEach(async () => {
        clientSocket.close();
        server.close();
    });

    describe('Authentication', () => {
        it('should authenticate user with valid token', async () => {
            expect(serverSocket.user).toBeDefined();
            expect(serverSocket.user._id.toString()).toBe(user1._id.toString());
            expect(serverSocket.userId).toBe(user1._id.toString());
        });

        it('should reject connection with invalid token', async () => {
            const invalidClient = Client(`http://localhost:${server.address().port}`, {
                auth: { token: 'invalid-token' }
            });

            await new Promise((resolve) => {
                invalidClient.on('connect_error', (error) => {
                    expect(error.message).toBe('Authentication error: Invalid token');
                    resolve();
                });
            });

            invalidClient.close();
        });

        it('should reject connection without token', async () => {
            const noTokenClient = Client(`http://localhost:${server.address().port}`);

            await new Promise((resolve) => {
                noTokenClient.on('connect_error', (error) => {
                    expect(error.message).toBe('Authentication error: No token provided');
                    resolve();
                });
            });

            noTokenClient.close();
        });
    });

    describe('Private Chat', () => {
        it('should join private chat room', async () => {
            await new Promise((resolve) => {
                clientSocket.emit('joinPrivateChat', { recipientId: user2._id.toString() });
                clientSocket.on('joinedPrivateChat', (data) => {
                    expect(data.room).toBe([user1._id.toString(), user2._id.toString()].sort().join('-'));
                    expect(data.recipientId).toBe(user2._id.toString());
                    resolve();
                });
            });
        });

        it('should send private message', async () => {
            const messageContent = 'Hello from user1';

            await new Promise((resolve) => {
                clientSocket.emit('sendPrivateMessage', {
                    recipientId: user2._id.toString(),
                    content: messageContent
                });
                clientSocket.on('newPrivateMessage', (message) => {
                    expect(message.content).toBe(messageContent);
                    expect(message.sender._id.toString()).toBe(user1._id.toString());
                    expect(message.recipient.toString()).toBe(user2._id.toString());
                    expect(message.chatType).toBe('private');
                    resolve();
                });
            });

            // Verify message is saved in database
            const savedMessage = await Message.findOne({
                sender: user1._id,
                recipient: user2._id,
                content: messageContent
            });
            expect(savedMessage).toBeDefined();
        });

        it('should return error for missing recipient ID', async () => {
            await new Promise((resolve) => {
                clientSocket.emit('joinPrivateChat', {});
                clientSocket.on('error', (data) => {
                    expect(data.message).toBe('Recipient ID is required');
                    resolve();
                });
            });
        });

        it('should return error for missing message content', async () => {
            await new Promise((resolve) => {
                clientSocket.emit('sendPrivateMessage', {
                    recipientId: user2._id.toString(),
                    content: ''
                });
                clientSocket.on('error', (data) => {
                    expect(data.message).toBe('Recipient ID and content are required');
                    resolve();
                });
            });
        });
    });

    describe('Group Chat', () => {
        it('should join group chat room', async () => {
            await new Promise((resolve) => {
                clientSocket.emit('joinGroupChat', { groupId: group1._id.toString() });
                clientSocket.on('joinedGroupChat', (data) => {
                    expect(data.groupId).toBe(group1._id.toString());
                    resolve();
                });
            });
        });

        it('should send group message', async () => {
            const messageContent = 'Hello group from user1';

            await new Promise((resolve) => {
                clientSocket.emit('sendGroupMessage', {
                    groupId: group1._id.toString(),
                    content: messageContent
                });
                clientSocket.on('newGroupMessage', (message) => {
                    expect(message.content).toBe(messageContent);
                    expect(message.sender._id.toString()).toBe(user1._id.toString());
                    expect(message.group.toString()).toBe(group1._id.toString());
                    expect(message.chatType).toBe('group');
                    resolve();
                });
            });

            // Verify message is saved in database
            const savedMessage = await Message.findOne({
                sender: user1._id,
                group: group1._id,
                content: messageContent
            });
            expect(savedMessage).toBeDefined();
        });

        it('should return error for unauthorized group access', async () => {
            const unauthorizedGroup = await Group.create({
                name: 'Unauthorized Group',
                members: [user2._id],
                admins: [user2._id]
            });

            await new Promise((resolve) => {
                clientSocket.emit('joinGroupChat', { groupId: unauthorizedGroup._id.toString() });
                clientSocket.on('error', (data) => {
                    expect(data.message).toBe('Access denied to group');
                    resolve();
                });
            });
        });

        it('should return error for missing group ID', async () => {
            await new Promise((resolve) => {
                clientSocket.emit('joinGroupChat', {});
                clientSocket.on('error', (data) => {
                    expect(data.message).toBe('Group ID is required');
                    resolve();
                });
            });
        });
    });

    describe('Message Reactions', () => {
        let message;

        beforeEach(async () => {
            message = await Message.create({
                sender: user1._id,
                recipient: user2._id,
                content: 'Test message for reactions',
                chatType: 'private'
            });
        });

        it('should add reaction to message', async () => {
            await new Promise((resolve) => {
                clientSocket.emit('addReaction', {
                    messageId: message._id.toString(),
                    reaction: 'like'
                });
                clientSocket.on('messageReactionAdded', (data) => {
                    expect(data.messageId).toBe(message._id.toString());
                    expect(data.reaction).toBe('like');
                    expect(data.userId).toBe(user1._id.toString());
                    expect(data.username).toBe(user1.username);
                    resolve();
                });
            });

            // Verify reaction is saved in database
            const updatedMessage = await Message.findById(message._id);
            expect(updatedMessage.reactions).toHaveLength(1);
            expect(updatedMessage.reactions[0].reaction).toBe('like');
            expect(updatedMessage.reactions[0].user.toString()).toBe(user1._id.toString());
        });

        it('should return error for invalid reaction', async () => {
            await new Promise((resolve) => {
                clientSocket.emit('addReaction', {
                    messageId: message._id.toString(),
                    reaction: 'invalid'
                });
                clientSocket.on('error', (data) => {
                    expect(data.message).toBe('Invalid message ID or reaction');
                    resolve();
                });
            });
        });

        it('should return error for duplicate reaction', async () => {
            // Add reaction first
            await new Promise((resolve) => {
                clientSocket.emit('addReaction', {
                    messageId: message._id.toString(),
                    reaction: 'like'
                });
                clientSocket.on('messageReactionAdded', resolve);
            });

            // Try to add same reaction again
            await new Promise((resolve) => {
                clientSocket.emit('addReaction', {
                    messageId: message._id.toString(),
                    reaction: 'like'
                });
                clientSocket.on('error', (data) => {
                    expect(data.message).toBe('Reaction already exists');
                    resolve();
                });
            });
        });
    });

    describe('Message Read Status', () => {
        let message;

        beforeEach(async () => {
            message = await Message.create({
                sender: user1._id,
                recipient: user2._id,
                content: 'Test message for read status',
                chatType: 'private'
            });
        });

        it('should mark message as read', async () => {
            await new Promise((resolve) => {
                clientSocket.emit('markMessageAsRead', {
                    messageId: message._id.toString()
                });
                clientSocket.on('messageRead', (data) => {
                    expect(data.messageId).toBe(message._id.toString());
                    expect(data.readBy).toBe(user1._id.toString());
                    resolve();
                });
            });

            // Verify read status is saved in database
            const updatedMessage = await Message.findById(message._id);
            expect(updatedMessage.readBy).toHaveLength(1);
            expect(updatedMessage.readBy[0].user.toString()).toBe(user1._id.toString());
        });
    });

    describe('Typing Indicators', () => {
        it('should emit typing indicator for private chat', async () => {
            const user2Client = Client(`http://localhost:${server.address().port}`, {
                auth: { token: token2 }
            });

            await new Promise((resolve) => {
                user2Client.on('connect', () => {
                    user2Client.emit('joinPrivateChat', { recipientId: user1._id.toString() });

                    clientSocket.emit('typing', {
                        chatType: 'private',
                        recipientId: user2._id.toString()
                    });

                    user2Client.on('userTyping', (data) => {
                        expect(data.userId).toBe(user1._id.toString());
                        expect(data.username).toBe(user1.username);
                        resolve();
                    });
                });
            });

            user2Client.close();
        });

        it('should emit stop typing indicator for private chat', async () => {
            const user2Client = Client(`http://localhost:${server.address().port}`, {
                auth: { token: token2 }
            });

            await new Promise((resolve) => {
                user2Client.on('connect', () => {
                    user2Client.emit('joinPrivateChat', { recipientId: user1._id.toString() });

                    clientSocket.emit('stopTyping', {
                        chatType: 'private',
                        recipientId: user2._id.toString()
                    });

                    user2Client.on('userStoppedTyping', (data) => {
                        expect(data.userId).toBe(user1._id.toString());
                        resolve();
                    });
                });
            });

            user2Client.close();
        });

        it('should emit typing indicator for group chat', async () => {
            const user2Client = Client(`http://localhost:${server.address().port}`, {
                auth: { token: token2 }
            });

            await new Promise((resolve) => {
                user2Client.on('connect', () => {
                    user2Client.emit('joinGroupChat', { groupId: group1._id.toString() });

                    clientSocket.emit('typing', {
                        chatType: 'group',
                        groupId: group1._id.toString()
                    });

                    user2Client.on('userTyping', (data) => {
                        expect(data.userId).toBe(user1._id.toString());
                        expect(data.username).toBe(user1.username);
                        resolve();
                    });
                });
            });

            user2Client.close();
        });
    });

    describe('Disconnect', () => {
        it('should update user status on disconnect', async () => {
            await new Promise((resolve) => {
                clientSocket.on('disconnect', () => {
                    resolve();
                });
                clientSocket.disconnect();
            });

            // Verify user status is updated
            const updatedUser = await User.findById(user1._id);
            expect(updatedUser.isOnline).toBe(false);
            expect(updatedUser.lastSeen).toBeDefined();
        });
    });
}); 