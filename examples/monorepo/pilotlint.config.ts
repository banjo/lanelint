import boundaries from '@pilotlint/plugin-boundaries';
import conventions from '@pilotlint/plugin-conventions';
import { defineConfig } from 'pilotlint';

export default defineConfig({
  include: ['packages/**', 'package.json'],
  elements: [
    {
      type: 'package',
      pattern: 'packages/:name',
      entry: 'src/index.ts',
      description: 'A workspace package. Other packages import it by name, through its entry.',
    },
  ],
  plugins: [boundaries, conventions],
  extends: [boundaries.configs.recommended, conventions.configs.recommended],
  rules: {
    'boundaries/entry-only': ['error', { elements: 'package' }],
    'boundaries/allowed-imports': [
      'error',
      {
        rules: [
          {
            from: { type: 'package', captures: { name: 'ui' } },
            disallow: 'package',
            message: 'The ui package must not depend on other workspace packages.',
          },
        ],
      },
    ],
    'conventions/directory-case': ['error', { case: 'kebab' }],
    'conventions/no-default-export': 'error',
  },
});
