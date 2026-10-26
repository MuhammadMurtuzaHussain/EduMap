import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: process.env.VITE_STATIC === '1' ? './' : '/',
  build: { outDir: 'dist', emptyOutDir: true },
  server: { proxy: { '/api': 'http://localhost:3000' } },
  test: { include: ['tests/**/*.test.ts'] },
});
