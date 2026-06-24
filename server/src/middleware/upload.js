import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { config } from '../config.js';
import { ApiError } from '../utils/http.js';

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.paths.uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

export const uploadAvatar = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(new ApiError(400, 'Avatar must be a PNG, JPEG, WEBP or GIF image'));
    }
    cb(null, true);
  },
}).single('avatar');
