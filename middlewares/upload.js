const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const eventsDir = path.join(__dirname, '..', 'public', 'images', 'events');
const uploadsDir = path.join(__dirname, '..', 'public', 'images', 'uploads');

[eventsDir, uploadsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Helper to create storage
const createStorage = (dest, prefix) => multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, prefix + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = "/jpeg|jpg|png|gif|webp/";
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    }
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
};

const baseOptions = {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: fileFilter
};

const eventUpload = multer({
    ...baseOptions,
    storage: createStorage(eventsDir, 'event-')
});

const avatarUpload = multer({
    ...baseOptions,
    storage: createStorage(uploadsDir, 'avatar-')
});

module.exports = {
    eventUpload,
    avatarUpload
};

