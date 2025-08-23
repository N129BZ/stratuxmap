import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      external: ['./ol-layerswitcher.js'] // Explicitly externalize ol-layerswitcher
    }
  },
  publicDir: '../public',
});