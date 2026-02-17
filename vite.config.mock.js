import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'mock-client',
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: '../dist-mock',
    emptyOutDir: true
  }
});
