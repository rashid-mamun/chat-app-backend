const Message = require('../models/Message');
const Group = require('../models/Group');
const { addFileJob } = require('../utils/queue');

// Send private message
const sendPrivateMessage = async (req, res) => {
    const { recipientId, content } = req.body;
    try {
        const message = new Message({
            sender: req.user.id,
            recipient: recipientId,
            content,
            chatType: 'private',
        });
        await message.save();
        res.status(201).json(message);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Send group message
const sendGroupMessage = async (req, res) => {
    const { groupId, content } = req.body;
    try {
        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ message: 'Group not found' });
        if (!group.members.includes(req.user.id)) return res.status(403).json({ message: 'Not a group member' });

        const message = new Message({
            sender: req.user.id,
            group: groupId,
            content,
            chatType: 'group',
        });
        await message.save();
        res.status(201).json(message);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Upload file
const uploadFile = async (req, res) => {
    try {
        const { chatType, recipientId, groupId } = req.body;
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const fileUrl = `/uploads/${req.file.filename}`;
        const message = new Message({
            sender: req.user.id,
            fileUrl,
            fileType: req.file.mimetype,
            chatType,
            recipient: chatType === 'private' ? recipientId : null,
            group: chatType === 'group' ? groupId : null,
        });
        await message.save();

        // Queue file processing job
        await addFileJob(fileUrl, req.user.id, chatType, recipientId, groupId);

        res.status(201).json(message);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Create group
const createGroup = async (req, res) => {
    const { name, memberIds } = req.body;
    try {
        const group = new Group({
            name,
            members: [req.user.id, ...memberIds],
            createdBy: req.user.id,
        });
        await group.save();
        res.status(201).json(group);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Get user chats
const getUserChats = async (req, res) => {
    try {
        const privateMessages = await Message.find({
            $or: [{ sender: req.user.id }, { recipient: req.user.id }],
            chatType: 'private',
        }).populate('sender recipient', 'username');

        const groupMessages = await Message.find({
            group: { $in: await Group.find({ members: req.user.id }).distinct('_id') },
            chatType: 'group',
        }).populate('sender', 'username');

        res.json({ privateMessages, groupMessages });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { sendPrivateMessage, sendGroupMessage, uploadFile, createGroup, getUserChats };