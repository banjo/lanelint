import { describe, expect, it } from 'vite-plus/test';
import { testRule } from '@pilotlint/core/testing';
import {
  allowedDirectories,
  companionFiles,
  directoryCase,
  exportMatchesFilename,
  exportNamePattern,
  fileNameCase,
  fileNamePattern,
  forbiddenDirectories,
  forbiddenFiles,
  noDefaultExport,
  noSuppressions,
  requiredFiles,
  rootOnlyFiles,
} from '../src/index.ts';

const framework = { describe, it, expect };

const config = { elements: [{ type: 'feature', pattern: 'src/features/:name' }] };

testRule(
  'conventions/no-default-export',
  noDefaultExport,
  {
    valid: [{ files: { 'a.ts': 'export const a = 1;\nexport { a as b };' } }],
    invalid: [
      {
        files: { 'a.ts': 'const a = 1;\nexport default a;' },
        findings: [
          { path: 'a.ts', line: 2, message: 'Use a named export instead of a default export.' },
        ],
      },
    ],
  },
  framework,
);

testRule(
  'conventions/file-name-case',
  fileNameCase,
  {
    valid: [
      {
        options: { case: ['camel', 'pascal'] },
        files: {
          'src/useThing.ts': '',
          'src/Button.test.tsx': '',
          'src/index.ts': '',
          'src/.eslintrc.js': '',
        },
      },
    ],
    invalid: [
      {
        options: { case: 'kebab' },
        files: { 'src/MyThing.stories.tsx': '' },
        findings: [
          {
            path: 'src/MyThing.stories.tsx',
            message: 'Rename MyThing.stories.tsx to kebab-case.',
            hint: 'For example my-thing.stories.tsx.',
          },
        ],
      },
    ],
  },
  framework,
);

testRule(
  'conventions/directory-case',
  directoryCase,
  {
    valid: [
      {
        options: { case: 'kebab' },
        files: { 'src/__tests__/a.ts': '', 'src/my-dir/a.ts': '', '.github/a.yml': '' },
      },
    ],
    invalid: [
      {
        options: { case: 'kebab' },
        files: { 'src/myDir/a.ts': '' },
        findings: [
          {
            path: 'src/myDir',
            message: 'Rename myDir/ to kebab-case.',
            hint: 'For example my-dir/.',
          },
        ],
      },
    ],
  },
  framework,
);

testRule(
  'conventions/forbidden-files',
  forbiddenFiles,
  {
    invalid: [
      {
        options: {
          patterns: [
            { name: 'types.ts', message: 'Move types to models/.' },
            { name: 'src/**/*.js' },
          ],
        },
        files: { 'src/a/types.ts': '', 'src/b.js': '', 'src/c.ts': '' },
        findings: [
          { path: 'src/a/types.ts', message: 'Move types to models/.' },
          { path: 'src/b.js', message: 'Files named src/**/*.js are not allowed.' },
        ],
      },
    ],
  },
  framework,
);

testRule(
  'conventions/allowed-directories',
  allowedDirectories,
  {
    valid: [
      {
        options: {
          rules: [{ directory: 'src/features/*', names: ['hooks', 'utils', '__tests__'] }],
        },
        files: {
          'src/features/a/hooks/use-a.ts': '',
          'src/features/a/hooks/use-b/use-b.ts': '',
          'src/features/a/__tests__/a.test.ts': '',
          'src/other/a.ts': '',
        },
      },
    ],
    invalid: [
      {
        options: { rules: [{ directory: 'src/features/*', names: ['hooks', 'utils'] }] },
        files: { 'src/features/a/util/a.ts': '', 'src/features/a/helpers/b.ts': '' },
        findings: [
          {
            path: 'src/features/a/helpers',
            message: 'helpers/ is not allowed in a/.',
            hint: 'Use one of: hooks, utils.',
          },
          { path: 'src/features/a/util', message: 'Rename util/ to utils/.' },
        ],
      },
      {
        options: {
          rules: [{ directory: 'features', names: ['*-feature'], message: 'Name it *-feature.' }],
        },
        files: { 'src/features/a/b.ts': '' },
        findings: [{ path: 'src/features/a', message: 'Name it *-feature.' }],
      },
    ],
  },
  framework,
);

testRule(
  'conventions/forbidden-directories',
  forbiddenDirectories,
  {
    invalid: [
      {
        options: { patterns: [{ name: '__tests__', message: 'Use tests/.' }] },
        files: { 'src/__tests__/a.test.ts': '' },
        findings: [{ path: 'src/__tests__', message: 'Use tests/.' }],
      },
    ],
  },
  framework,
);

testRule(
  'conventions/root-only-files',
  rootOnlyFiles,
  {
    valid: [
      {
        config,
        options: { names: ['index.ts'] },
        files: { 'src/features/a/index.ts': '', 'src/index.ts': '' },
      },
    ],
    invalid: [
      {
        config,
        options: { names: ['index.ts', 'messages.ts'] },
        files: { 'src/features/a/hooks/index.ts': '', 'src/features/a/hooks/messages.ts': '' },
        findings: [
          {
            path: 'src/features/a/hooks/index.ts',
            message: 'index.ts belongs only at the root of src/features/a.',
          },
          {
            path: 'src/features/a/hooks/messages.ts',
            message: 'messages.ts belongs only at the root of src/features/a.',
          },
        ],
      },
    ],
  },
  framework,
);

testRule(
  'conventions/file-name-pattern',
  fileNamePattern,
  {
    valid: [
      {
        options: { rules: [{ directory: 'utils', pattern: '*Util.ts' }] },
        files: {
          'src/utils/dateUtil.ts': '',
          'src/utils/dateUtil.test.ts': '',
          'src/other/date.ts': '',
        },
      },
    ],
    invalid: [
      {
        options: { rules: [{ directory: 'utils', pattern: '*Util.ts' }] },
        files: { 'src/utils/date.ts': '' },
        findings: [
          { path: 'src/utils/date.ts', message: 'Files in utils/ must be named *Util.ts.' },
        ],
      },
    ],
  },
  framework,
);

testRule(
  'conventions/required-files',
  requiredFiles,
  {
    valid: [
      {
        config,
        options: { files: [{ in: 'feature', path: 'index.{ts,tsx}' }] },
        files: { 'src/features/a/index.tsx': '', 'src/features/a/b.ts': '' },
      },
    ],
    invalid: [
      {
        config,
        options: {
          files: [
            { in: 'feature', path: 'index.ts' },
            { in: { directories: 'src/features/*/components/*' }, path: '*.tsx' },
          ],
        },
        files: { 'src/features/a/b.ts': '', 'src/features/a/components/button/style.css': '' },
        findings: [
          { path: 'src/features/a', message: 'src/features/a has no index.ts.' },
          {
            path: 'src/features/a/components/button',
            message: 'src/features/a/components/button has no *.tsx.',
          },
        ],
      },
    ],
  },
  framework,
);

testRule(
  'conventions/companion-files',
  companionFiles,
  {
    valid: [
      {
        options: { rules: [{ files: 'src/**/*.tsx', requires: '{stem}.test.tsx' }] },
        files: { 'src/Button.tsx': '', 'src/Button.test.tsx': '' },
      },
    ],
    invalid: [
      {
        options: { rules: [{ files: 'src/**/*.tsx', requires: '{stem}.test.tsx' }] },
        paths: ['src/Card.tsx'],
        files: { 'src/Card.tsx': '' },
        findings: [{ path: 'src/Card.test.tsx', message: 'src/Card.tsx needs src/Card.test.tsx.' }],
      },
    ],
  },
  framework,
);

testRule(
  'conventions/export-matches-filename',
  exportMatchesFilename,
  {
    valid: [
      {
        options: { allowDeprecated: true },
        files: {
          'dateUtil.ts': [
            'export type Format = string;',
            'export const DateUtil = {};',
            '/** @deprecated Use DateUtil.format. */',
            'export const format = () => {};',
          ].join('\n'),
        },
      },
    ],
    invalid: [
      {
        files: {
          'dateUtil.ts': "export const format = () => {};\nexport * from './other.ts';",
          'other.ts': '',
        },
        paths: ['dateUtil.ts'],
        findings: [
          { path: 'dateUtil.ts', line: 1, message: 'Export DateUtil from dateUtil.ts.' },
          { path: 'dateUtil.ts', line: 1, message: 'Move format into DateUtil.' },
          {
            path: 'dateUtil.ts',
            line: 2,
            message: 'Do not re-export whole modules from dateUtil.ts; export DateUtil only.',
          },
        ],
      },
    ],
  },
  framework,
);

testRule(
  'conventions/export-name-pattern',
  exportNamePattern,
  {
    invalid: [
      {
        options: { rules: [{ files: '**/hooks/*.ts', pattern: 'use[A-Z]*' }] },
        files: {
          'src/hooks/useA.ts':
            'export const useA = 1;\nexport const helper = 1;\nexport type T = 1;',
          'src/other.ts': 'export const helper = 1;',
        },
        findings: [
          { path: 'src/hooks/useA.ts', line: 2, message: 'Rename helper to match use[A-Z]*.' },
        ],
      },
    ],
  },
  framework,
);

testRule(
  'conventions/no-suppressions',
  noSuppressions,
  {
    valid: [
      {
        options: { allow: ['@ts-expect-error'] },
        files: {
          'a.ts':
            "// @ts-expect-error -- testing\nconst text = '// @ts-ignore';\n// Explains when @ts-ignore is ok.",
          'b.md': '// @ts-ignore',
        },
      },
    ],
    invalid: [
      {
        files: {
          'a.ts': [
            'const a = 1;',
            '// @ts-ignore',
            '/* eslint-disable no-console */',
            '// oxlint-disable-next-line no-unused-vars',
            '/* v8 ignore next */',
          ].join('\n'),
        },
        findings: [
          {
            path: 'a.ts',
            line: 2,
            message: 'Remove the @ts-ignore comment and fix the problem it hides.',
          },
          { path: 'a.ts', line: 3, message: /eslint-disable/ },
          { path: 'a.ts', line: 4, message: /oxlint-disable/ },
          { path: 'a.ts', line: 5, message: /v8 ignore/ },
        ],
      },
    ],
  },
  framework,
);
