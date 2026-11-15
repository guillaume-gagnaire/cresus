import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@cresus/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
      '~': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
  test: { include: ['test/**/*.test.ts'] },
});
