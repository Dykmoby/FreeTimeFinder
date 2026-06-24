import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During development the API runs separately (port 4000); proxy to it so the
// frontend can use same-origin paths like "/api/...". In production the Express
// server serves the built files and this proxy is irrelevant.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },
});
