import { verifyToken } from '../utils/token.js';
import { Users } from '../models/user.model.js';
import { ApiError } from '../utils/http.js';

/**
 * Require a valid Bearer token. Attaches the current user to req.user.
 */
export function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new ApiError(401, 'Not authenticated'));

  try {
    const payload = verifyToken(token);
    const user = Users.findById(payload.sub);
    if (!user) return next(new ApiError(401, 'Account no longer exists'));
    req.user = user;
    next();
  } catch {
    next(new ApiError(401, 'Invalid or expired session'));
  }
}
