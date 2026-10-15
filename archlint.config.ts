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
    'boundaries/restricted-packages': [
      'error',
      {
        packages: [
          {
            name: 'node:{fs,fs/promises,child_process,http,https,http2,net,dgram,dns,os,process,readline,worker_threads,cluster,timers,timers/promises}',
            from: { files: 'packages/*/src/**/utils/**' },
            message: 'Utils are pure functions.',
            hint: 'Move code that touches files, processes, the network, or timers to a service.',
          },
          {
            name: '{c12,jiti,oxc-resolver,tinyglobby,axios,ky,undici,node-fetch}',
            from: { files: 'packages/*/src/**/utils/**' },
            message: 'Utils are pure functions.',
            hint: 'Move code that loads files or calls the network to a service.',
          },
        ],
      },
    ],
    'boundaries/restricted-globals': [
      'error',
      {
        globals: [
          'fetch',
          'XMLHttpRequest',
          'WebSocket',
          'process',
          'console',
          'require',
          'Date.now',
          'Math.random',
          'crypto',
          'performance',
          'setTimeout',
          'setInterval',
          'setImmediate',
          'localStorage',
          'sessionStorage',
          'document',
          'window',
          'navigator',
        ].map((name) => ({
          name,
          from: { files: 'packages/*/src/**/utils/**' },
          message: 'Utils are pure functions.',
          hint: 'Pass the value in as an argument, or move the code to a service.',
        })),
      },
    ],
    'conventions/directory-case': ['error', { case: 'kebab' }],
    'conventions/file-name-case': ['error', { case: 'camel', ignore: ['index.*', '.*', '*.md'] }],
    'conventions/file-name-pattern': [
      'error',
      {
        rules: [
          {
            directory: 'utils',
            pattern: '*Util.ts',
            message: 'Utils are pure functions in files named *Util.ts.',
          },
          {
            directory: 'services',
            pattern: '*Service.ts',
            message: 'Services hold logic with side effects, in files named *Service.ts.',
          },
        ],
      },
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
      description: 'Utils and services export one object named after the file.',
      files: ['packages/*/src/**/utils/*Util.ts', 'packages/*/src/**/services/*Service.ts'],
      rules: { 'conventions/export-matches-filename': 'error' },
    },
  ],
});
