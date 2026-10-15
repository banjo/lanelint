import boundaries from '@archlint/plugin-boundaries';
import changes from '@archlint/plugin-changes';
import conventions from '@archlint/plugin-conventions';
import { defineConfig } from 'archlint';

export default defineConfig({
  include: ['src/**', 'package.json', 'archlint.config.ts'],
  elements: [
    {
      type: 'feature',
      pattern: 'src/features/:name',
      description: 'A user-facing feature. Other code imports it only through its index.ts.',
    },
    {
      type: 'domain',
      pattern: 'src/common/:name',
      description: 'Shared business logic. Import the file you need, not the domain root.',
    },
    {
      type: 'shared',
      pattern: 'src/:name',
      where: { name: ['hooks', 'utils'] },
      description: 'Generic code without business logic.',
    },
  ],
  plugins: [boundaries, changes, conventions],
  extends: [boundaries.configs.recommended, conventions.configs.recommended],
  rules: {
    'boundaries/allowed-imports': [
      'error',
      {
        rules: [
          { from: 'shared', disallow: ['feature', 'domain'] },
          { from: 'domain', disallow: 'feature' },
        ],
      },
    ],
    'boundaries/entry-only': ['error', { elements: 'feature' }],
    'boundaries/no-entry-import': [
      'error',
      {
        rules: [
          { from: 'feature', to: 'self' },
          { from: 'domain', to: 'domain' },
        ],
      },
    ],
    'boundaries/public-api': ['error', { elements: 'domain' }],
    'boundaries/no-orphans': ['warn', { roots: ['src/main.ts'] }],
    'conventions/directory-case': ['error', { case: 'kebab' }],
    'conventions/forbidden-files': [
      'error',
      { patterns: [{ name: 'types.ts', message: 'Put types in named files in models/.' }] },
    ],
    'conventions/root-only-files': ['error', { names: ['index.ts', 'messages.ts'] }],
    'conventions/file-name-pattern': [
      'error',
      { rules: [{ directory: 'utils', pattern: '*Util.ts' }] },
    ],
    'changes/requires-change': [
      'error',
      {
        rules: [
          {
            when: 'src/**/messages.ts',
            require: 'src/translations/en.json',
            hint: 'Add the new message ids to src/translations/en.json.',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      description: 'Feature and domain code uses named exports, except message catalogs.',
      elements: ['feature', 'domain'],
      ignore: ['**/messages.ts'],
      rules: { 'conventions/no-default-export': 'error' },
    },
    {
      description: 'Util files export one object named after the file.',
      files: ['src/**/utils/*Util.ts'],
      rules: { 'conventions/export-matches-filename': 'error' },
    },
  ],
});
