const {
    getPrivateMessages,
    getGroupMessages,
    getUserChats,
    searchMessages,
    searchMessagesAdvanced
} = require('../../services/chatService');
const Message = require('../../models/Message');
const User = require('../../models/User');
const Group = require('../../models/Group');
const { AppError } = require('../../middleware/errorHandler');
const mongoose = require('mongoose');

describe('Chat Service', () => {
    let user1, user2, group;

    beforeEach(async () => {
        await User.deleteMany({});
        await Group.deleteMany({});
        await Message.deleteMany({});

        user1 = await User.create({
            username: 'user1',
            email: 'user1@example.com',
            password: 'Password123!'
        });

        user2 = await User.create({
            username: 'user2',
            email: 'user2@example.com',
            password: 'Password123!'
        });

        group = await Group.create({
            name: 'Test Group',
            members: [user1._id, user2._id],
            admins: [user1._id]
        });
    });

    describe('getPrivateMessages', () => {
        it('should retrieve private messages between two users', async () => {
            await Message.create({
                sender: user1._id,
                recipient: user2._id,
                content: 'Hello',
                chatType: 'private'
            });

            const messages = await getPrivateMessages(user1._id, user2._id);
            expect(messages).toHaveLength(1);
            expect(messages[0].content).toBe('Hello');
            expect(messages[0].sender.username).toBe('user1');
        });

        it('should return empty array if no messages exist', async () => {
            const messages = await getPrivateMessages(user1._id, user2._id);
            expect(messages).toEqual([]);
        });
    });

    describe('getGroupMessages', () => {
        it('should retrieve group messages for authorized user', async () => {
            await Message.create({
                sender: user1._id,
                group: group._id,
                content: 'Group message',
                chatType: 'group'
            });

            const messages = await getGroupMessages(group._id, user1._id);
            expect(messages).toHaveLength(1);
            expect(messages[0].content).toBe('Group message');
            expect(messages[0].sender.username).toBe('user1');
        });

        it('should throw error for unauthorized group access', async () => {
            const otherUser = await User.create({
                username: 'other',
                email: 'other@example.com',
                password: 'Password123!'
            });

            await expect(getGroupMessages(group._id, otherUser._id))
                .rejects
                .toThrow(AppError);
            await expect(getGroupMessages(group._id, otherUser._id))
                .rejects
                .toThrow('Access denied to group');
        });
    });

    describe('getUserChats', () => {
        it('should retrieve user’s private and group chats', async () => {
            await Message.create({
                sender: user1._id,
                recipient: user2._id,
                content: 'Private message',
                chatType: 'private'
            });

            await Message.create({
                sender: user1._id,
                group: group._id,
                content: 'Group message',
                chatType: 'group'
            });

            const chats = await getUserChats(user1._id);
            expect(chats.privateChats).toHaveLength(1);
            expect(chats.groupChats).toHaveLength(1);
            expect(chats.privateChats[0].user.username).toBe('user2');
            expect(chats.groupChats[0].name).toBe('Test Group');
        });
    });

    describe('searchMessages', () => {
        it('should search private messages by content', async () => {
            await Message.create({
                sender: user1._id,
                recipient: user2._id,
                content: 'Hello world',
                chatType: 'private'
            });

            const messages = await searchMessages(user1._id, 'world', 'private', user2._id);
            expect(messages).toHaveLength(1);
            expect(messages[0].content).toBe('Hello world');
            expect(messages[0].sender.username).toBe('user1');
        });

        it('should search group messages by content', async () => {
            await Message.create({
                sender: user1._id,
                group: group._id,
                content: 'Group hello',
                chatType: 'group'
            });

            const messages = await searchMessages(user1._id, 'hello', 'group', group._id);
            expect(messages).toHaveLength(1);
            expect(messages[0].content).toBe('Group hello');
            expect(messages[0].sender.username).toBe('user1');
        });
    });

    describe('searchMessagesAdvanced', () => {
        it('should search messages with advanced filters', async () => {
            await Message.create({
                sender: user1._id,
                recipient: user2._id,
                content: 'Hello world',
                chatType: 'private',
                createdAt: new Date('2025-07-01')
            });

            const result = await searchMessagesAdvanced(user1._id, 'world', {
                chatType: 'private',
                chatId: user2._id,
                startDate: '2025-07-01',
                endDate: '2025-07-02'
            });

            expect(result.messages).toHaveLength(1);
            expect(result.messages[0].content).toBe('Hello world');
            expect(result.messages[0].sender.username).toBe('user1');
            expect(result.total).toBe(1);
            expect(result.page).toBe(1);
            expect(result.totalPages).toBe(1);
        });

        it('should filter by file type', async () => {
            await Message.create({
                sender: user1._id,
                group: group._id,
                content: 'Image message',
                chatType: 'group',
                fileType: 'image',
                fileUrl: 'test.jpg'
            });

            const result = await searchMessagesAdvanced(user1._id, null, {
                chatType: 'group',
                chatId: group._id,
                fileType: 'image'
            });

            expect(result.messages).toHaveLength(1);
            expect(result.messages[0].fileType).toBe('image');
            expect(result.messages[0].sender.username).toBe('user1');
        });
    });
});