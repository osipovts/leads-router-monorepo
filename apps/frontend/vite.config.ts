import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The gateway does not enable CORS, so in dev we proxy API requests to it.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
