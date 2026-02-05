import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'server',
    include: ['__tests__/**/*.test.ts'],
    environment: 'node',
  },
});
