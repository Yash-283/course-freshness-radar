import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build output goes straight into the project's public/ folder,
// which the existing Express server (src/server.js) already serves.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../public',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5173,
    // While developing (npm run dev), forward API calls to the running dashboard server
    proxy: { '/api': 'http://localhost:3100' },
  },
});
