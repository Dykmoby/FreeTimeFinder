import { avatarUrl } from '../api.js';
import { resolveGradient, cssGradient } from '../lib/avatarGradients.js';

function initials(name = '?') {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '?';
}

export default function Avatar({ user, size = 40 }) {
  const style = { width: size, height: size, fontSize: size * 0.4 };
  if (user?.avatar) {
    return (
      <img
        className="avatar"
        style={style}
        src={avatarUrl(user.avatar)}
        alt={user.nickname}
      />
    );
  }
  return (
    <span
      className="avatar avatar--fallback"
      style={{ ...style, backgroundImage: cssGradient(resolveGradient(user)) }}
    >
      {initials(user?.nickname || user?.username)}
    </span>
  );
}
