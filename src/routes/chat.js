const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const upload = require('../utils/fileUpload');
const {
    sendPrivateMessage,
    sendGroupMessage,
    uploadFile,
    createGroup,
    getUserChats,
} = require('../controllers/chatController');

router.use(authMiddleware);

router.post('/private', sendPrivateMessage);
router.post('/group', sendGroupMessage);
router.post('/file', upload.single('file'), uploadFile);
router.post('/group/create', createGroup);
router.get('/chats', getUserChats);

module.exports = router;