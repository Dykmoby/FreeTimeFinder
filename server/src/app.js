import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { config } from './config.js';
import apiRoutes from './routes/index.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.clientOrigins }));
  app.use(express.json({ limit: '1mb' }));

  // Uploaded avatars.
  app.use('/uploads', express.static(config.paths.uploadsDir));

  // API.
  app.use('/api', apiRoutes);

  // In production, serve the built React app and let it handle client routing.
  if (fs.existsSync(config.paths.clientDist)) {
    app.use(express.static(config.paths.clientDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
      res.sendFile('index.html', { root: config.paths.clientDist });
    });
  }

  // 404 for unmatched API routes.
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // Central error handler.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large (max 2 MB)' : err.message;
      return res.status(400).json({ error: msg });
    }
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: err.message || 'Server error' });
  });

  return app;
}
