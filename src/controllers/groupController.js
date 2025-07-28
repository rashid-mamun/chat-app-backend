const Group = require('../models/Group');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const createGroup = async (req, res, next) => {
    try {
        const { name, members } = req.body;

        if (!name || !members || !Array.isArray(members)) {
            throw new AppError('Group name and members array are required', 400);
        }

        // Validate that all members exist
        const memberUsers = await User.find({ _id: { $in: members } });
        if (memberUsers.length !== members.length) {
            throw new AppError('One or more members not found', 400);
        }

        const group = new Group({
            name,
            members: [req.user._id, ...members],
            admins: [req.user._id]
        });
        await group.save();

        await group.populate('members', 'username email avatar');

        res.status(201).json({
            success: true,
            message: 'Group created successfully',
            data: group
        });
    } catch (error) {
        next(error);
    }
};

const getGroups = async (req, res, next) => {
    try {
        const groups = await Group.find({ members: req.user._id })
            .populate('members', 'username email avatar')
            .populate('admins', 'username email avatar');

        res.json({
            success: true,
            data: groups
        });
    } catch (error) {
        next(error);
    }
};

const getGroup = async (req, res, next) => {
    try {
        const { groupId } = req.params;
        const group = await Group.findById(groupId)
            .populate('members', 'username email avatar')
            .populate('admins', 'username email avatar');

        if (!group) {
            throw new AppError('Group not found', 404);
        }

        if (!group.members.some(member => member._id.toString() === req.user._id.toString())) {
            throw new AppError('Access denied to group', 403);
        }

        res.json({
            success: true,
            data: group
        });
    } catch (error) {
        next(error);
    }
};

const updateGroup = async (req, res, next) => {
    try {
        const { groupId } = req.params;
        const { name } = req.body;

        const group = await Group.findById(groupId);
        if (!group) {
            throw new AppError('Group not found', 404);
        }

        if (!group.admins.some(admin => admin.toString() === req.user._id.toString())) {
            throw new AppError('Only group admins can update group', 403);
        }

        if (name) {
            group.name = name;
        }

        await group.save();
        await group.populate('members', 'username email avatar');
        await group.populate('admins', 'username email avatar');

        res.json({
            success: true,
            message: 'Group updated successfully',
            data: group
        });
    } catch (error) {
        next(error);
    }
};

const deleteGroup = async (req, res, next) => {
    try {
        const { groupId } = req.params;
        const group = await Group.findById(groupId);

        if (!group) {
            throw new AppError('Group not found', 404);
        }

        if (!group.admins.some(admin => admin.toString() === req.user._id.toString())) {
            throw new AppError('Only group admins can delete group', 403);
        }

        await Group.findByIdAndDelete(groupId);

        res.json({
            success: true,
            message: 'Group deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

const addMember = async (req, res, next) => {
    try {
        const { groupId } = req.params;
        const { memberId } = req.body;

        const group = await Group.findById(groupId);
        if (!group) {
            throw new AppError('Group not found', 404);
        }

        if (!group.admins.some(admin => admin.toString() === req.user._id.toString())) {
            throw new AppError('Only group admins can add members', 403);
        }

        if (group.members.some(member => member.toString() === memberId)) {
            throw new AppError('User is already a member of this group', 400);
        }

        const user = await User.findById(memberId);
        if (!user) {
            throw new AppError('User not found', 404);
        }

        group.members.push(memberId);
        await group.save();
        await group.populate('members', 'username email avatar');

        res.json({
            success: true,
            message: 'Member added successfully',
            data: group
        });
    } catch (error) {
        next(error);
    }
};

const removeMember = async (req, res, next) => {
    try {
        const { groupId, memberId } = req.params;

        const group = await Group.findById(groupId);
        if (!group) {
            throw new AppError('Group not found', 404);
        }

        if (!group.admins.some(admin => admin.toString() === req.user._id.toString())) {
            throw new AppError('Only group admins can remove members', 403);
        }

        if (memberId === req.user._id.toString()) {
            throw new AppError('You cannot remove yourself from the group', 400);
        }

        group.members = group.members.filter(member => member.toString() !== memberId);
        group.admins = group.admins.filter(admin => admin.toString() !== memberId);

        await group.save();
        await group.populate('members', 'username email avatar');

        res.json({
            success: true,
            message: 'Member removed successfully',
            data: group
        });
    } catch (error) {
        next(error);
    }
};

const addAdmin = async (req, res, next) => {
    try {
        const { groupId } = req.params;
        const { adminId } = req.body;

        const group = await Group.findById(groupId);
        if (!group) {
            throw new AppError('Group not found', 404);
        }

        if (!group.admins.some(admin => admin.toString() === req.user._id.toString())) {
            throw new AppError('Only group admins can add admins', 403);
        }

        if (!group.members.some(member => member.toString() === adminId)) {
            throw new AppError('User must be a member of the group to become admin', 400);
        }

        if (group.admins.some(admin => admin.toString() === adminId)) {
            throw new AppError('User is already an admin of this group', 400);
        }

        group.admins.push(adminId);
        await group.save();
        await group.populate('admins', 'username email avatar');

        res.json({
            success: true,
            message: 'Admin added successfully',
            data: group
        });
    } catch (error) {
        next(error);
    }
};

const removeAdmin = async (req, res, next) => {
    try {
        const { groupId, adminId } = req.params;

        const group = await Group.findById(groupId);
        if (!group) {
            throw new AppError('Group not found', 404);
        }

        if (!group.admins.some(admin => admin.toString() === req.user._id.toString())) {
            throw new AppError('Only group admins can remove admins', 403);
        }

        if (adminId === req.user._id.toString()) {
            throw new AppError('You cannot remove yourself as admin', 400);
        }

        group.admins = group.admins.filter(admin => admin.toString() !== adminId);
        await group.save();
        await group.populate('admins', 'username email avatar');

        res.json({
            success: true,
            message: 'Admin removed successfully',
            data: group
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createGroup,
    getGroups,
    getGroup,
    updateGroup,
    deleteGroup,
    addMember,
    removeMember,
    addAdmin,
    removeAdmin
};
