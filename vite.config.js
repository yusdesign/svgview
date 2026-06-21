import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/svgview/' : '/',
  server: {
    host: true,
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    // Remove rollupOptions entirely for simplicity
  },
  plugins: [],
  optimizeDeps: {
    exclude: ['@capacitor/core']
  },
  // Ensure assets are resolved correctly
  publicDir: 'public'
});
