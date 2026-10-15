import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    entry: {
      index: 'src/index.ts',
      testing: 'src/testing/index.ts',
    },
    dts: {
      generator: 'tsgo',
    },
    exports: {
      devExports: true,
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
