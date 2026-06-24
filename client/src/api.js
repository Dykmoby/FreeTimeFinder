const TOKEN_KEY = 'fff_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Thin fetch wrapper. Adds the auth token, JSON-encodes plain objects
 * (but leaves FormData alone for file uploads), and throws ApiError on failure.
 */
export async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const opts = { method, headers: { ...headers } };
  const token = tokenStore.get();
  if (token) opts.headers.Authorization = `Bearer ${token}`;

  if (body instanceof FormData) {
    opts.body = body; // browser sets the multipart Content-Type
  } else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`/api${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status})`);
  return data;
}

/** Build the public URL for an uploaded avatar filename. */
export function avatarUrl(filename) {
  return filename ? `/uploads/${filename}` : null;
}
