import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Use relative paths for Electron loadFile() compatibility
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
  },
});
