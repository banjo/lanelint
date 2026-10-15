import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    dts: {
      generator: 'tsgo',
    },
    exports: {
      devExports: true,
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
