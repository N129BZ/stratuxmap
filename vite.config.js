import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      input: 'src/map.html',
      external: ['./ol-layerswitcher.js'] // Explicitly externalize ol-layerswitcher
    },
    chunkSizeWarningLimit: 3000, // Increase chunk size warning limit to 2000 kB
  },
  publicDir: '../public',
});