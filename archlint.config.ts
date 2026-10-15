import boundaries from '@archlint/plugin-boundaries';
import changes from '@archlint/plugin-changes';
import conventions from '@archlint/plugin-conventions';
import { defineConfig } from 'archlint';

export default defineConfig({
  include: ['packages/**', 'package.json'],
  ignore: ['**/dist/**'],
  elements: [
    {
      type: 'package',
      pattern: 'packages/:name',
      entry: ['src/index.ts', 'src/testing/index.ts'],
      description: 'A published package. Other packages import it by name.',
    },
  ],
  plugins: [boundaries, changes, conventions],
  extends: [boundaries.configs.recommended, conventions.configs.recommended],
  rules: {
    'boundaries/allowed-imports': [
      'error',
      {
        rules: [
          {
            from: { type: 'package', captures: { name: 'core' } },
            disallow: 'package',
            message: '@archlint/core must not depend on other archlint packages.',
          },
          {
            from: {
              type: 'package',
              captures: { name: ['plugin-boundaries', 'plugin-conventions', 'plugin-changes'] },
            },
            allow: { type: 'package', captures: { name: 'core' } },
            message: 'Plugins depend only on @archlint/core.',
          },
        ],
      },
    ],
    'boundaries/entry-only': ['error', { elements: 'package' }],
    'boundaries/no-orphans': ['error', { roots: ['packages/archlint/src/cli/index.ts'] }],
    'conventions/directory-case': ['error', { case: 'kebab' }],
    'conventions/file-name-case': ['error', { case: 'camel', ignore: ['index.*', '.*', '*.md'] }],
    'conventions/file-name-pattern': [
      'error',
      { rules: [{ directory: 'utils', pattern: '*Util.ts' }] },
    ],
    'conventions/forbidden-directories': [
      'error',
      { patterns: [{ name: '__tests__', message: 'Put tests in the package tests/ directory.' }] },
    ],
    'changes/requires-change': [
      'error',
      {
        rules: [
          {
            when: 'packages/*/src/**',
            require: '.changeset/*.md',
            hint: 'Run pnpm changeset to describe the change for the changelog.',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      description: 'Packages use named exports, except plugin entries and config files.',
      files: ['packages/**'],
      ignore: ['packages/plugin-*/src/index.ts', '**/*.config.ts'],
      rules: { 'conventions/no-default-export': 'error' },
    },
    {
      description: 'Util files export one object named after the file.',
      files: ['packages/*/src/**/utils/*Util.ts'],
      rules: { 'conventions/export-matches-filename': 'error' },
    },
  ],
});
