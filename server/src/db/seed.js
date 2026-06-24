import { config } from '../config.js';
import { Users } from '../models/user.model.js';
import { hashPassword } from '../utils/password.js';

/**
 * Ensure there is always an admin account.
 * Runs on every start but only creates the admin the first time
 * (when no admin exists yet).
 */
export async function ensureAdmin() {
  if (Users.countAdmins() > 0) return;

  const existing = Users.findRawByUsername(config.admin.username);
  if (existing) {
    // Username taken by a non-admin — leave it alone, just warn.
    console.warn(
      `[seed] No admin exists but username "${config.admin.username}" is taken. ` +
        'Set a different ADMIN_USERNAME or promote a user manually.'
    );
    return;
  }

  const passwordHash = await hashPassword(config.admin.password);
  Users.create({
    username: config.admin.username,
    nickname: config.admin.nickname,
    passwordHash,
    role: 'admin',
    mustChangePassword: true, // force changing the default password on first login
  });

  console.log(
    `[seed] Created admin account "${config.admin.username}". ` +
      'Log in and change the password immediately.'
  );
}
