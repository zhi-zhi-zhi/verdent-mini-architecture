import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  // Package-level tests
  'packages/*/vitest.config.ts',
  'server/vitest.config.ts',
  // Cross-package integration tests
  {
    test: {
      name: 'integration',
      root: './tests',
      include: ['integration/**/*.test.ts'],
      environment: 'node',
      testTimeout: 10000,
    },
  },
]);
