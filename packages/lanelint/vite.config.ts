import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    entry: {
      index: 'src/index.ts',
      cli: 'src/cli/index.ts',
    },
    dts: {
      generator: 'tsgo',
    },
    exports: {
      devExports: true,
      customExports(exports) {
        // The CLI is a bin, not an import entry.
        delete exports['./cli'];
        return exports;
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
