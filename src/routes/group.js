const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const {
    createGroup,
    getGroups,
    getGroup,
    updateGroup,
    deleteGroup,
    addMember,
    removeMember,
    addAdmin,
    removeAdmin
} = require('../controllers/groupController');

// Group CRUD operations
router.post('/', authMiddleware, createGroup);
router.get('/', authMiddleware, getGroups);
router.get('/:groupId', authMiddleware, getGroup);
router.put('/:groupId', authMiddleware, updateGroup);
router.delete('/:groupId', authMiddleware, deleteGroup);

// Group member management
router.post('/:groupId/members', authMiddleware, addMember);
router.delete('/:groupId/members/:memberId', authMiddleware, removeMember);

// Group admin management
router.post('/:groupId/admins', authMiddleware, addAdmin);
router.delete('/:groupId/admins/:adminId', authMiddleware, removeAdmin);

module.exports = router;
