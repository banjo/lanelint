import { defineConfig } from 'vite-plus';

export default defineConfig({
  staged: {
    '*': ['vp check --fix', 'lanelint check --new'],
  },
  fmt: {
    singleQuote: true,
    printWidth: 100,
    ignorePatterns: ['**/dist/**', 'pnpm-lock.yaml', '.changeset/*.md', 'docs/rules/**'],
  },
  lint: {
    ignorePatterns: ['**/dist/**'],
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: { 'vite-plus/prefer-vite-plus-imports': 'error' },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: true,
  },
  test: {
    projects: ['packages/*'],
  },
});
