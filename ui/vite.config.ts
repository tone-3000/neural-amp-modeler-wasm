import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  // basic-ssl serves the dev app over https with a self-signed cert. Needed
  // for testing on other devices (e.g. iPhone over LAN): AudioWorklet
  // requires a secure context, and only localhost is exempt.
  plugins: [react(), basicSsl()],
  css: {
    postcss: './postcss.config.js',
  },
  server: {
    port: 3000,
    open: true,
    // No COOP/COEP headers: the v2 engine needs no SharedArrayBuffer or
    // cross-origin isolation.
  },
  build: {
    outDir: 'dist',
    lib: {
      entry: 'src/index.ts',
      formats: ['es', 'cjs'],
      fileName: format => `index.${format === 'es' ? 'esm' : 'js'}`,
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
});
