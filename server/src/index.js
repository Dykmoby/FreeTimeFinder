import { config } from './config.js';
import { initSchema } from './db/index.js';
import { ensureAdmin } from './db/seed.js';
import { createApp } from './app.js';

async function main() {
  initSchema();
  await ensureAdmin();

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`Free Time Finder API listening on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
