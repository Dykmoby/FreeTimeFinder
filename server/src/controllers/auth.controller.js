import { Users, toPublic } from '../models/user.model.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signToken } from '../utils/token.js';
import { ApiError, asyncHandler } from '../utils/http.js';

export const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) throw new ApiError(400, 'Username and password are required');

  const raw = Users.findRawByUsername(username);
  if (!raw || !(await verifyPassword(password, raw.password_hash))) {
    throw new ApiError(401, 'Wrong username or password');
  }

  const user = toPublic(raw);
  res.json({ token: signToken(user), user });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6) {
    throw new ApiError(400, 'New password must be at least 6 characters');
  }

  const raw = Users.findRawById(req.user.id);
  if (!(await verifyPassword(currentPassword || '', raw.password_hash))) {
    throw new ApiError(400, 'Current password is incorrect');
  }

  Users.setPassword(req.user.id, await hashPassword(newPassword), { mustChange: false });
  res.json({ user: Users.findById(req.user.id) });
});
