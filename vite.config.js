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
        // Vite 8 requires manualChunks as a function
        manualChunks(id) {
          // Group vendor dependencies
          if (id.includes('node_modules')) {
            if (id.includes('@capacitor')) {
              return 'capacitor';
            }
            if (id.includes('vite')) {
              return 'vite';
            }
            return 'vendor';
          }
        }
      }
    }
  },
  plugins: [],
  optimizeDeps: {
    exclude: ['@capacitor/core']
  }
});
