import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..');

export const config = {
  port: Number(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
  tokenExpiresIn: process.env.TOKEN_EXPIRES_IN || '7d',

  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin',
    nickname: process.env.ADMIN_NICKNAME || 'Admin',
  },

  // Allow multiple comma-separated dev origins.
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  paths: {
    serverRoot,
    dbFile: path.join(serverRoot, 'data', 'app.db'),
    schemaFile: path.join(serverRoot, 'src', 'db', 'schema.sql'),
    uploadsDir: path.join(serverRoot, 'uploads'),
    // Built client (created by `npm run build`); served in production.
    clientDist: path.resolve(serverRoot, '..', 'client', 'dist'),
  },

  isProduction: process.env.NODE_ENV === 'production',
};
