const multer = require('multer');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, process.env.UPLOAD_PATH || './uploads');
    },
    filename: (req, file, cb) => {
        const ext = file.mimetype.split('/')[1];
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || ['jpeg', 'jpg', 'png', 'gif', 'pdf', 'doc', 'docx', 'txt', 'plain'];
    const fileType = file.mimetype.split('/')[1];
    const fileExtension = file.originalname.split('.').pop().toLowerCase();

    // Check if either the MIME type or file extension is allowed
    if (allowedTypes.includes(fileType) || allowedTypes.includes(fileExtension)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: process.env.MAX_FILE_SIZE || 10 * 1024 * 1024 }
}).single('file');

module.exports = { upload };
