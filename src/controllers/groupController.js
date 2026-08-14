const mongoose = require('mongoose');
const Group = require('../models/Group');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const createGroup = async (req, res, next) => {
    try {
        const { name, members, privacy } = req.body;

        // Name is always required
        if (!name) {
            throw new AppError('Group name and members array are required', 400);
        }

        // members must be an array if provided; if missing entirely also 400
        if (!members || !Array.isArray(members)) {
            throw new AppError('Group name and members array are required', 400);
        }

        // Validate member IDs only when the array has entries
        if (members.length > 0) {
            // Validate ObjectId format first
            const invalidIds = members.filter(id => !mongoose.Types.ObjectId.isValid(id));
            if (invalidIds.length > 0) {
                throw new AppError('One or more members not found', 400);
            }

            const memberDocs = await User.find({ _id: { $in: members } });
            if (memberDocs.length !== members.length) {
                throw new AppError('One or more members not found', 400);
            }
        }

        const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();

        // Add creator first, then provided members (dedup in case creator is in the list)
        const allMemberIds = [req.user._id, ...members.filter(id => id.toString() !== req.user._id.toString())];

        const group = new Group({
            name,
            members: allMemberIds,
            admins: [req.user._id],
            privacy: privacy || 'public',
            inviteCode
        });

        await group.save();

        await group.populate('members', 'username email avatar isOnline status lastSeen');

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
            .populate('members', 'username email avatar isOnline status lastSeen')
            .populate('admins', 'username email avatar isOnline status lastSeen');

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
            .populate('members', 'username email avatar isOnline status lastSeen')
            .populate('admins', 'username email avatar isOnline status lastSeen');

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
        await group.populate('members', 'username email avatar isOnline status lastSeen');
        await group.populate('admins', 'username email avatar isOnline status lastSeen');

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

const joinGroup = async (req, res, next) => {
    try {
        const { groupId } = req.body;
        const group = await Group.findById(groupId);
        if (!group) {
            throw new AppError('Group not found', 404);
        }

        if (group.members.some(member => member.toString() === req.user._id.toString())) {
            throw new AppError('You are already a member of this group', 400);
        }

        if (group.privacy === 'public') {
            // Auto join for public groups
            group.members.push(req.user._id);
            await group.save();
            await group.populate('members', 'username email avatar isOnline status lastSeen');
            
            return res.json({
                success: true,
                message: 'Joined group successfully',
                data: group
            });
        } else {
            // Join request for private groups
            const existingRequest = group.joinRequests.find(r => r.user.toString() === req.user._id.toString() && r.status === 'pending');
            if (existingRequest) {
                throw new AppError('Join request already pending', 400);
            }

            group.joinRequests.push({ user: req.user._id });
            await group.save();

            res.json({
                success: true,
                message: 'Join request sent to admins'
            });
        }
    } catch (error) {
        next(error);
    }
};

const inviteMember = async (req, res, next) => {
    try {
        const { groupId } = req.params;
        const { memberId } = req.body;

        const group = await Group.findById(groupId);
        if (!group) {
            throw new AppError('Group not found', 404);
        }

        // Only members can invite (or only admins? user didn't specify, I'll allow members for now or admins)
        if (!group.members.some(m => m.toString() === req.user._id.toString())) {
            throw new AppError('Only group members can invite others', 403);
        }

        if (group.members.some(member => member.toString() === memberId)) {
            throw new AppError('User is already a member', 400);
        }

        const existingInvite = group.invites.find(i => i.user.toString() === memberId && i.status === 'pending');
        if (existingInvite) {
            throw new AppError('Invitation already sent', 400);
        }

        group.invites.push({ user: memberId, inviter: req.user._id });
        await group.save();

        res.json({
            success: true,
            message: 'Invitation sent to user'
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

        const userExists = await User.findById(memberId);
        if (!userExists) {
            throw new AppError('User not found', 404);
        }

        if (group.members.some(member => member.toString() === memberId)) {
            throw new AppError('User is already a member of this group', 400);
        }

        group.members.push(memberId);
        await group.save();
        await group.populate('members', 'username email avatar isOnline status lastSeen');

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
        await group.populate('members', 'username email avatar isOnline status lastSeen');

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
        await group.populate('admins', 'username email avatar isOnline status lastSeen');

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
        await group.populate('admins', 'username email avatar isOnline status lastSeen');

        res.json({
            success: true,
            message: 'Admin removed successfully',
            data: group
        });
    } catch (error) {
        next(error);
    }
};

const handleJoinRequest = async (req, res, next) => {
    try {
        const { groupId, userId, action } = req.body; // action: 'approve' | 'reject'
        const group = await Group.findById(groupId);
        if (!group) throw new AppError('Group not found', 404);

        if (!group.admins.some(a => a.toString() === req.user._id.toString())) {
            throw new AppError('Only admins can manage join requests', 403);
        }

        const requestIndex = group.joinRequests.findIndex(r => r.user.toString() === userId && r.status === 'pending');
        if (requestIndex === -1) throw new AppError('Request not found', 404);

        if (action === 'approve') {
            group.joinRequests[requestIndex].status = 'approved';
            if (!group.members.some(m => m.toString() === userId)) {
                group.members.push(userId);
            }
        } else {
            group.joinRequests[requestIndex].status = 'rejected';
        }

        await group.save();
        res.json({ success: true, message: `Request ${action}d` });
    } catch (error) {
        next(error);
    }
};

const handleInviteResponse = async (req, res, next) => {
    try {
        const { groupId, action } = req.body; // action: 'accept' | 'reject'
        const group = await Group.findById(groupId);
        if (!group) throw new AppError('Group not found', 404);

        const inviteIndex = group.invites.findIndex(i => i.user.toString() === req.user._id.toString() && i.status === 'pending');
        if (inviteIndex === -1) throw new AppError('Invitation not found', 404);

        if (action === 'accept') {
            group.invites[inviteIndex].status = 'accepted';
            if (!group.members.some(m => m.toString() === req.user._id.toString())) {
                group.members.push(req.user._id);
            }
        } else {
            group.invites[inviteIndex].status = 'rejected';
        }

        await group.save();
        res.json({ success: true, message: `Invitation ${action}ed` });
    } catch (error) {
        next(error);
    }
};

const leaveGroup = async (req, res, next) => {
    try {
        const { groupId } = req.params;
        const { forceDelete } = req.query; // If last admin chooses to delete
        const group = await Group.findById(groupId);
        if (!group) throw new AppError('Group not found', 404);

        const isAdmin = group.admins.some(a => a.toString() === req.user._id.toString());
        const isLastAdmin = isAdmin && group.admins.length === 1;

        if (isLastAdmin && group.members.length > 1 && forceDelete !== 'true') {
            return res.status(200).json({
                success: true,
                requireConfirmation: true,
                message: 'You are the last admin. Do you want to delete the group or promote someone else?'
            });
        }

        if (isLastAdmin && (group.members.length === 1 || forceDelete === 'true')) {
            await Group.findByIdAndDelete(groupId);
            return res.json({ success: true, message: 'Group deleted as you were the last member/admin' });
        }

        group.members = group.members.filter(m => m.toString() !== req.user._id.toString());
        group.admins = group.admins.filter(a => a.toString() !== req.user._id.toString());

        // Auto-promote if no admins left but members exist
        if (group.admins.length === 0 && group.members.length > 0) {
            group.admins.push(group.members[0]);
        }

        await group.save();
        res.json({ success: true, message: 'Left group successfully' });
    } catch (error) {
        next(error);
    }
};

// Preview a group by inviteCode or groupId (no membership required)
const previewGroup = async (req, res, next) => {
    try {
        const { code } = req.params;
        let group;

        // Try as inviteCode first
        group = await Group.findOne({ inviteCode: code });

        // Fallback to ObjectId
        if (!group && mongoose.Types.ObjectId.isValid(code)) {
            group = await Group.findById(code);
        }

        if (!group) throw new AppError('Group not found. Check the code and try again.', 404);

        const isMember = group.members.some(m => m.toString() === req.user._id.toString());
        const hasPendingRequest = group.joinRequests.some(
            r => r.user.toString() === req.user._id.toString() && r.status === 'pending'
        );
        const hasPendingInvite = group.invites.some(
            i => i.user.toString() === req.user._id.toString() && i.status === 'pending'
        );

        res.json({
            success: true,
            data: {
                _id: group._id,
                name: group.name,
                privacy: group.privacy,
                avatar: group.avatar,
                memberCount: group.members.length,
                isMember,
                hasPendingRequest,
                hasPendingInvite
            }
        });
    } catch (error) {
        next(error);
    }
};

// Get all pending invites for the current user
const getPendingInvites = async (req, res, next) => {
    try {
        const groups = await Group.find({
            invites: { $elemMatch: { user: req.user._id, status: 'pending' } }
        }).populate('invites.inviter', 'username avatar');

        const invites = groups.map(group => {
            const invite = group.invites.find(
                i => i.user.toString() === req.user._id.toString() && i.status === 'pending'
            );
            return {
                groupId: group._id,
                groupName: group.name,
                groupAvatar: group.avatar,
                inviterName: invite?.inviter?.username || 'Someone',
                inviterId: invite?.inviter?._id,
                createdAt: invite?.createdAt
            };
        });

        res.json({ success: true, data: invites });
    } catch (error) {
        next(error);
    }
};

// Get all pending join requests for groups where user is admin
const getPendingRequests = async (req, res, next) => {
    try {
        const groups = await Group.find({
            admins: req.user._id,
            'joinRequests.status': 'pending'
        }).populate('joinRequests.user', 'username avatar');

        const requests = [];
        groups.forEach(group => {
            group.joinRequests
                .filter(r => r.status === 'pending')
                .forEach(r => {
                    requests.push({
                        groupId: group._id,
                        groupName: group.name,
                        groupAvatar: group.avatar,
                        userId: r.user._id,
                        username: r.user.username,
                        userAvatar: r.user.avatar,
                        createdAt: r.createdAt
                    });
                });
        });

        res.json({ success: true, data: requests });
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
    joinGroup,
    inviteMember,
    handleJoinRequest,
    handleInviteResponse,
    leaveGroup,
    addMember,
    removeMember,
    addAdmin,
    removeAdmin,
    previewGroup,
    getPendingInvites,
    getPendingRequests
};
