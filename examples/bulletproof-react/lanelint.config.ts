import boundaries from '@lanelint/plugin-boundaries';
import conventions from '@lanelint/plugin-conventions';
import { bulletproofReact } from '@lanelint/presets';
import { defineConfig } from 'lanelint';

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
