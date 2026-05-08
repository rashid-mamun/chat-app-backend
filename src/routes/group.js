const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const {
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
    removeMember,
    addAdmin,
    removeAdmin,
    previewGroup,
    getPendingInvites,
    getPendingRequests
} = require('../controllers/groupController');

// Group CRUD operations
router.post('/', authMiddleware, createGroup);
router.get('/', authMiddleware, getGroups);
router.post('/join', authMiddleware, joinGroup);
router.post('/handle-request', authMiddleware, handleJoinRequest);
router.post('/handle-invite', authMiddleware, handleInviteResponse);

// Pending invites & requests for current user
router.get('/my/pending-invites', authMiddleware, getPendingInvites);
router.get('/my/pending-requests', authMiddleware, getPendingRequests);

// Group preview (no membership required)
router.get('/preview/:code', authMiddleware, previewGroup);

router.get('/:groupId', authMiddleware, getGroup);
router.put('/:groupId', authMiddleware, updateGroup);
router.delete('/:groupId', authMiddleware, deleteGroup);

// Group member management
router.post('/:groupId/invite', authMiddleware, inviteMember);
router.post('/:groupId/leave', authMiddleware, leaveGroup);
router.delete('/:groupId/members/:memberId', authMiddleware, removeMember);

// Group admin management
router.post('/:groupId/admins', authMiddleware, addAdmin);
router.delete('/:groupId/admins/:adminId', authMiddleware, removeAdmin);

module.exports = router;
