// Gradient presets for the fallback (no-image) avatar. Ids must match the
// server allowlist in controllers/profile.controller.js.
export const AVATAR_GRADIENTS = [
  { id: 'violet', from: '#7f5af0', to: '#2cb1bc' },
  { id: 'rose', from: '#e53170', to: '#7f5af0' },
  { id: 'sunset', from: '#ff8906', to: '#f25f4c' },
  { id: 'gold', from: '#f25f4c', to: '#ffd803' },
  { id: 'mint', from: '#2cb1bc', to: '#a7f3d0' },
  { id: 'sky', from: '#3da9fc', to: '#90b4ce' },
  { id: 'ember', from: '#f25f4c', to: '#e53170' },
  { id: 'ocean', from: '#2cb1bc', to: '#3da9fc' },
];

const byId = new Map(AVATAR_GRADIENTS.map((g) => [g.id, g]));

export const gradientById = (id) => byId.get(id) || null;

/** Stable gradient chosen from a name, so each person gets a consistent colour. */
export function gradientForSeed(seed = '?') {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

/** The gradient to actually paint for a user: their pick, else a hashed default. */
export function resolveGradient(user) {
  return gradientById(user?.avatarColor) || gradientForSeed(user?.nickname || user?.username);
}

export const cssGradient = (g) => `linear-gradient(135deg, ${g.from}, ${g.to})`;
