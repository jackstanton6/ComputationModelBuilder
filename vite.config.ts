/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/cmb/',
  plugins: [react()],
  build: {
    outDir: 'dist/cmb',
    emptyOutDir: true,
    manifest: true,
    target: 'es2022',
  },
  worker: { format: 'es' },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60000,
  },
});
