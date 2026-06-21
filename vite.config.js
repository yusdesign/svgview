import { defineConfig } from 'vite';

export default defineConfig({
  base: '/svgview/',
  server: {
    host: true,
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['@capacitor/core', '@capacitor/filesystem']
        }
      }
    }
  },
  plugins: [],
  optimizeDeps: {
    exclude: ['@capacitor/core']
  }
});
