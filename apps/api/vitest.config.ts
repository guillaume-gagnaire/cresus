import { fileURLToPath } from 'node:url';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: {
    alias: { '@matreso/engine': fileURLToPath(new URL('../../packages/engine/src/index.ts', import.meta.url)) },
  },
  test: {
    include: ['test/**/*.e2e.test.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
