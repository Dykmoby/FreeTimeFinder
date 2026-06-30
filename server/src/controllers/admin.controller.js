import fs from 'node:fs';
import path from 'node:path';
import { Users } from '../models/user.model.js';
import { Availability } from '../models/availability.model.js';
import { config } from '../config.js';
import { hashPassword } from '../utils/password.js';
import { ApiError, asyncHandler, parseDay } from '../utils/http.js';
import { readInterval, readDayIntervals, readDayWindow, readUtcRange } from './availability.controller.js';

function validateUsername(username) {
  if (!username || typeof username !== 'string') throw new ApiError(400, 'Username is required');
  const trimmed = username.trim();
  if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(trimmed)) {
    throw new ApiError(400, 'Username must be 3–30 chars: letters, digits, _ . -');
  }
  return trimmed;
}

function validateRole(role) {
  if (role === undefined) return undefined;
  if (role !== 'user' && role !== 'admin') throw new ApiError(400, 'Role must be "user" or "admin"');
  return role;
}

// --- Users -----------------------------------------------------------------

export const listUsers = asyncHandler(async (_req, res) => {
  res.json({ users: Users.list() });
});

export const createUser = asyncHandler(async (req, res) => {
  const username = validateUsername(req.body?.username);
  const role = validateRole(req.body?.role) || 'user';
  const nickname = (req.body?.nickname || username).trim().slice(0, 40);
  const tempPassword = req.body?.password;
  if (!tempPassword || tempPassword.length < 4) {
    throw new ApiError(400, 'Temporary password must be at least 4 characters');
  }
  if (Users.findRawByUsername(username)) throw new ApiError(409, 'Username already taken');

  const user = Users.create({
    username,
    nickname,
    role,
    passwordHash: await hashPassword(tempPassword),
    mustChangePassword: true,
  });
  res.status(201).json({ user });
});

export const updateUser = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const target = Users.findById(id);
  if (!target) throw new ApiError(404, 'User not found');

  const patch = {};
  if (req.body?.username !== undefined) {
    const username = validateUsername(req.body.username);
    const clash = Users.findRawByUsername(username);
    if (clash && clash.id !== id) throw new ApiError(409, 'Username already taken');
    patch.username = username;
  }
  if (req.body?.nickname !== undefined) {
    const nickname = String(req.body.nickname).trim();
    if (!nickname || nickname.length > 40) throw new ApiError(400, 'Nickname must be 1–40 chars');
    patch.nickname = nickname;
  }
  const role = validateRole(req.body?.role);
  if (role !== undefined) {
    // Don't allow demoting the last remaining admin.
    if (target.role === 'admin' && role === 'user' && Users.countAdmins() <= 1) {
      throw new ApiError(400, 'Cannot demote the last admin');
    }
    patch.role = role;
  }

  res.json({ user: Users.update(id, patch) });
});

export const resetUserPassword = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Users.findById(id)) throw new ApiError(404, 'User not found');
  const password = req.body?.password;
  if (!password || password.length < 4) {
    throw new ApiError(400, 'Temporary password must be at least 4 characters');
  }
  Users.setPassword(id, await hashPassword(password), { mustChange: true });
  res.json({ ok: true });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const target = Users.findById(id);
  if (!target) throw new ApiError(404, 'User not found');
  if (target.role === 'admin' && Users.countAdmins() <= 1) {
    throw new ApiError(400, 'Cannot delete the last admin');
  }

  if (target.avatar) {
    fs.rm(path.join(config.paths.uploadsDir, target.avatar), { force: true }, () => {});
  }
  Users.remove(id); // availability rows cascade-delete
  res.json({ ok: true });
});

// --- Editing other users' availability ------------------------------------

export const listUserAvailability = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  if (!Users.findById(userId)) throw new ApiError(404, 'User not found');
  res.json({ availability: Availability.listByUser(userId, readUtcRange(req.query)) });
});

export const createUserInterval = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  if (!Users.findById(userId)) throw new ApiError(404, 'User not found');
  const iv = readInterval(req.body || {});
  res.status(201).json({ interval: Availability.create({ userId, ...iv }) });
});

/** Replace a user's whole day (used by the admin slot-grid editor). */
export const replaceUserDay = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  if (!Users.findById(userId)) throw new ApiError(404, 'User not found');
  const day = parseDay(req.body?.day);
  // Mirror replaceMyDay: validate the already-reconciled, audience-carrying set
  // without merging (merging would fuse blocks with different visibility).
  const cleaned = readDayIntervals(req.body);
  res.json({ availability: Availability.replaceDay(userId, day, cleaned, readDayWindow(req.body)) });
});

export const updateInterval = asyncHandler(async (req, res) => {
  const existing = Availability.findById(Number(req.params.intervalId));
  if (!existing) throw new ApiError(404, 'Interval not found');
  const iv = readInterval({ ...existing, ...req.body });
  res.json({ interval: Availability.update(existing.id, iv) });
});

export const deleteInterval = asyncHandler(async (req, res) => {
  const existing = Availability.findById(Number(req.params.intervalId));
  if (!existing) throw new ApiError(404, 'Interval not found');
  Availability.remove(existing.id);
  res.json({ ok: true });
});
