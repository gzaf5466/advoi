const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadRoot = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadRoot)) {
  fs.mkdirSync(uploadRoot, { recursive: true });
}

// Configure disk storage with safe filenames
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadRoot);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    cb(null, `${base}_${timestamp}${ext}`);
  }
});

// Allowed mime types for chat apps
const allowedMimeTypes = new Set([
  // images
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
  // video
  'video/mp4', 'video/webm', 'video/ogg',
  // audio
  'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm',
  // docs
  'application/pdf', 'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]);

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type'));
  }
};

// 20MB max file size (adjust as needed)
const limits = { fileSize: 20 * 1024 * 1024 };

const upload = multer({ storage, fileFilter, limits });

module.exports = {
  upload,
  uploadRoot
};
