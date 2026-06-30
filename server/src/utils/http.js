// Small helpers to keep controllers clean.

/** Throwable error carrying an HTTP status code. */
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Wrap an async route handler so thrown errors reach the error middleware. */
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/** Validate / parse a minute-of-day value (0..1440). */
export function parseMinute(value, field) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 1440) {
    throw new ApiError(400, `Invalid value for "${field}"`);
  }
  return n;
}

/** Validate / parse an epoch-milliseconds UTC instant. */
export function parseEpochMs(value, field) {
  const n = Number(value);
  if (!Number.isInteger(n) || !Number.isFinite(n)) {
    throw new ApiError(400, `Invalid value for "${field}"`);
  }
  return n;
}

/** Validate a 'YYYY-MM-DD' day string. */
export function parseDay(value, field = 'day') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(400, `Invalid value for "${field}" (expected YYYY-MM-DD)`);
  }
  return value;
}
