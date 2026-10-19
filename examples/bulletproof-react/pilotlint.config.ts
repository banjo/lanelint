import boundaries from '@pilotlint/plugin-boundaries';
import conventions from '@pilotlint/plugin-conventions';
import { bulletproofReact } from '@pilotlint/presets';
import { defineConfig } from 'pilotlint';

export default defineConfig({
  include: ['src/**'],
  plugins: [conventions],
  extends: [boundaries.configs.recommended, bulletproofReact()],
  rules: {
    'conventions/forbidden-files': [
      'error',
      {
        patterns: [{ name: '{utils,helpers,types}.ts', message: 'Split it into files by topic.' }],
      },
    ],
    'conventions/forbidden-directories': [
      'error',
      { patterns: [{ name: 'helpers', message: 'Put helpers in utils/.' }] },
    ],
    'conventions/file-name-pattern': [
      'error',
      { rules: [{ directory: 'utils', pattern: '*Util.ts' }] },
    ],
    'conventions/no-default-export': 'error',
  },
  overrides: [
    {
      description: 'Util files export one object named after the file.',
      files: ['src/**/utils/*Util.ts'],
      rules: { 'conventions/export-matches-filename': 'error' },
    },
  ],
});
