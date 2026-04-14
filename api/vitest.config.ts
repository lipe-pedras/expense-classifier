import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/errors/**/*.test.ts'],
    exclude: ['tests/integration/**'],
    environment: 'node',
    testTimeout: 10000,
    globals: false,
  },
});
