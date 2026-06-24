import fs from 'node:fs';
import path from 'node:path';
import { Users } from '../models/user.model.js';
import { config } from '../config.js';
import { ApiError, asyncHandler } from '../utils/http.js';

// Gradient preset ids the fallback avatar may use (kept in sync with the
// client's lib/avatarGradients.js). null clears the choice (back to auto).
const AVATAR_COLOR_IDS = ['violet', 'rose', 'sunset', 'gold', 'mint', 'sky', 'ember', 'ocean'];

/** Update the current user's own nickname and/or fallback-avatar gradient. */
export const updateMyProfile = asyncHandler(async (req, res) => {
  const { nickname, avatarColor } = req.body || {};
  if (nickname !== undefined && (!nickname.trim() || nickname.length > 40)) {
    throw new ApiError(400, 'Nickname must be 1–40 characters');
  }
  if (avatarColor !== undefined && avatarColor !== null && !AVATAR_COLOR_IDS.includes(avatarColor)) {
    throw new ApiError(400, 'Unknown avatar colour');
  }
  const user = Users.update(req.user.id, {
    nickname: nickname?.trim(),
    avatarColor, // undefined leaves it untouched; null clears it
  });
  res.json({ user });
});

/** Replace the current user's avatar (file uploaded via multer). */
export const updateMyAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No image uploaded');

  const previous = Users.findById(req.user.id)?.avatar;
  const user = Users.update(req.user.id, { avatar: req.file.filename });

  // Remove the old file so uploads/ doesn't grow forever.
  if (previous) {
    fs.rm(path.join(config.paths.uploadsDir, previous), { force: true }, () => {});
  }
  res.json({ user });
});

export const removeMyAvatar = asyncHandler(async (req, res) => {
  const previous = Users.findById(req.user.id)?.avatar;
  const user = Users.update(req.user.id, { avatar: null });
  if (previous) {
    fs.rm(path.join(config.paths.uploadsDir, previous), { force: true }, () => {});
  }
  res.json({ user });
});
