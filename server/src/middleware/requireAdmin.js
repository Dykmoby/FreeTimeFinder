import { ApiError } from '../utils/http.js';

/** Allow only admins. Must run after requireAuth. */
export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') return next(new ApiError(403, 'Admins only'));
  next();
}
