import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Integration tests share one database; running files in parallel would
    // have them delete each other's fixtures mid-run.
    fileParallelism: false,
    setupFiles: ['./src/test/setup.ts'],
  },
});
