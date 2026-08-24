const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Ensure upload directory exists
const uploadDir = path.resolve(process.env.UPLOAD_PATH || 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    // Keep browser-served uploads to formats with a narrow attack surface.
    const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/wav',
        'video/mp4', 'video/webm',
        'application/pdf', 'text/plain'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

router.post('/', authMiddleware, (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            // A Multer error occurred when uploading.
            return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
        } else if (err) {
            // An unknown error occurred when uploading.
            return res.status(400).json({ success: false, message: err.message });
        }

        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'No file uploaded' });
            }

            const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
            
            let fileType = 'other';
            if (req.file.mimetype.startsWith('image/')) fileType = 'image';
            else if (req.file.mimetype.startsWith('audio/')) fileType = 'audio';
            else if (req.file.mimetype.startsWith('video/')) fileType = 'video';
            else if (req.file.mimetype === 'application/pdf') fileType = 'document';

            res.status(200).json({
                success: true,
                data: {
                    fileUrl,
                    fileName: req.file.originalname,
                    fileType,
                    fileSize: req.file.size
                }
            });
        } catch (error) {
            logger.error('File upload controller error:', error);
            res.status(500).json({ success: false, message: 'Server error processing file' });
        }
    });
});

module.exports = router;
