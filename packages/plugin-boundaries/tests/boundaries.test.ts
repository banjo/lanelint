import { describe, expect, it } from 'vite-plus/test';
import { testRule } from '@archlint/core/testing';
import {
  allowedImports,
  entryOnly,
  noCycles,
  noEntryImport,
  noOrphans,
  noUndeclaredDependency,
  noUnresolved,
  publicApi,
  restrictedPackages,
} from '../src/index.ts';

const framework = { describe, it, expect };

const config = {
  elements: [
    { type: 'feature', pattern: 'src/features/:name' },
    { type: 'domain', pattern: 'src/common/:name' },
    { type: 'shared', pattern: 'src/:name', where: { name: ['api', 'hooks', 'utils'] } },
  ],
};

testRule(
  'boundaries/allowed-imports',
  allowedImports,
  {
    valid: [
      {
        name: 'imports inside an element and allowed targets',
        config,
        options: { rules: [{ from: 'shared', disallow: 'feature' }] },
        files: {
          'src/hooks/useA.ts':
            "import { b } from './useB.ts';\nimport { d } from '../common/d/index.ts';",
          'src/hooks/useB.ts': 'export const b = 1;',
          'src/common/d/index.ts': 'export const d = 1;',
        },
      },
      {
        name: 'test files are skipped',
        config,
        options: { rules: [{ from: 'shared', disallow: 'feature' }] },
        files: {
          'src/hooks/useA.test.ts': "import { a } from '../features/a/index.ts';",
          'src/features/a/index.ts': 'export const a = 1;',
        },
      },
    ],
    invalid: [
      {
        name: 'disallowed target',
        config,
        options: { rules: [{ from: 'shared', disallow: 'feature' }] },
        files: {
          'src/hooks/useA.ts': "\nimport { a } from '../features/a/index.ts';",
          'src/features/a/index.ts': 'export const a = 1;',
        },
        findings: [
          {
            path: 'src/hooks/useA.ts',
            line: 2,
            message: 'the shared src/hooks must not import the feature src/features/a.',
          },
        ],
      },
      {
        name: 'allow list and file selectors',
        config,
        options: {
          rules: [
            { from: 'feature', allow: ['domain', 'shared', { type: 'feature' }] },
            {
              from: 'feature',
              disallow: { files: 'src/features/index.ts' },
              message: 'Import the feature, not the aggregator.',
            },
          ],
        },
        files: {
          'src/features/a/index.ts':
            "import { x } from '../../other/x.ts';\nimport { all } from '../index.ts';",
          'src/features/index.ts': 'export const all = 1;',
          'src/other/x.ts': 'export const x = 1;',
        },
        findings: [
          { path: 'src/features/a/index.ts', line: 1, message: /must not import src\/other\/x.ts/ },
          {
            path: 'src/features/a/index.ts',
            line: 2,
            message: 'Import the feature, not the aggregator.',
          },
        ],
      },
    ],
  },
  framework,
);

testRule(
  'boundaries/entry-only',
  entryOnly,
  {
    valid: [
      {
        config,
        options: { elements: ['feature'] },
        files: {
          'src/features/a/index.ts':
            "import { b } from '../b/index.ts';\nimport { c } from './c.ts';",
          'src/features/a/c.ts': 'export const c = 1;',
          'src/features/b/index.ts': 'export const b = 1;',
        },
      },
    ],
    invalid: [
      {
        config,
        options: { elements: ['feature'] },
        files: {
          'src/features/a/index.ts': "import { b } from '../b/hooks/useB.ts';",
          'src/features/b/index.ts': "export { b } from './hooks/useB.ts';",
          'src/features/b/hooks/useB.ts': 'export const b = 1;',
        },
        findings: [
          {
            path: 'src/features/a/index.ts',
            line: 1,
            message:
              'Import src/features/b through its entry file, not src/features/b/hooks/useB.ts.',
            hint: 'Export what you need from src/features/b/index.ts and import it from there.',
          },
        ],
      },
    ],
  },
  framework,
);

testRule(
  'boundaries/no-entry-import',
  noEntryImport,
  {
    invalid: [
      {
        config,
        options: {
          rules: [
            { from: 'feature', to: 'self' },
            { from: 'domain', to: 'domain' },
          ],
        },
        files: {
          'src/features/a/hooks/useA.ts': "import { a } from '../index.ts';",
          'src/features/a/index.ts': 'export const a = 1;',
          'src/common/x/model.ts': "import { y } from '../y/index.ts';",
          'src/common/y/index.ts': 'export const y = 1;',
        },
        findings: [
          {
            path: 'src/common/x/model.ts',
            message: /Import the file you need from src\/common\/y/,
          },
          { path: 'src/features/a/hooks/useA.ts', message: /not its own entry file/ },
        ],
      },
    ],
  },
  framework,
);

testRule(
  'boundaries/public-api',
  publicApi,
  {
    valid: [
      {
        name: 'files re-exported through barrels and imported bindings',
        config,
        options: { elements: ['domain'] },
        files: {
          'src/features/a/index.ts':
            "import { m } from '../../common/x/models/m.ts';\nimport { n } from '../../common/x/utils/n.ts';",
          'src/common/x/index.ts':
            "export * from './models/index.ts';\nimport { n } from './utils/n.ts';\nexport { n };",
          'src/common/x/models/index.ts': "export { m } from './m.ts';",
          'src/common/x/models/m.ts': 'export const m = 1;',
          'src/common/x/utils/n.ts': 'export const n = 1;',
        },
      },
    ],
    invalid: [
      {
        config,
        options: { elements: ['domain'] },
        files: {
          'src/features/a/index.ts': "import { p } from '../../common/x/private.ts';",
          'src/common/x/index.ts': 'export const x = 1;',
          'src/common/x/private.ts': 'export const p = 1;',
        },
        findings: [
          {
            path: 'src/features/a/index.ts',
            message:
              'src/common/x/private.ts is not exported from the entry files of src/common/x.',
          },
        ],
      },
    ],
  },
  framework,
);

testRule(
  'boundaries/no-cycles',
  noCycles,
  {
    valid: [
      {
        config,
        files: {
          'src/features/a/index.ts': "import { b } from '../b/index.ts';",
          'src/features/b/index.ts': "import { c } from '../../common/c/index.ts';",
          'src/common/c/index.ts': 'export const c = 1;',
        },
      },
    ],
    invalid: [
      {
        config,
        files: {
          'src/features/a/index.ts': "import { b } from '../b/index.ts';",
          'src/features/b/index.ts': "import { c } from '../c/index.ts';",
          'src/features/c/index.ts': "import { a } from '../a/index.ts';",
        },
        findings: [
          {
            path: 'src/features/a/index.ts',
            message:
              'Dependency cycle: src/features/a -> src/features/b -> src/features/c -> src/features/a.',
          },
        ],
      },
      {
        name: 'anchored at the changed file',
        config,
        paths: ['src/features/c'],
        files: {
          'src/features/a/index.ts': "import { b } from '../b/index.ts';",
          'src/features/b/index.ts':
            "import { a } from '../a/index.ts';\nimport { c } from '../c/index.ts';",
          'src/features/c/index.ts': "import { b } from '../b/index.ts';",
        },
        findings: [
          {
            path: 'src/features/c/index.ts',
            message: 'Dependency cycle: src/features/c -> src/features/b -> src/features/c.',
          },
        ],
      },
    ],
  },
  framework,
);

testRule(
  'boundaries/no-unresolved',
  noUnresolved,
  {
    invalid: [
      {
        files: { 'a.ts': "import { b } from './b';\nimport x from 'missing-package';" },
        findings: [
          { path: 'a.ts', line: 1, message: 'Cannot resolve "./b".' },
          { path: 'a.ts', line: 2, message: 'Cannot resolve "missing-package".' },
        ],
      },
    ],
  },
  framework,
);

testRule(
  'boundaries/restricted-packages',
  restrictedPackages,
  {
    valid: [
      {
        options: {
          packages: [{ name: '@mui/material', allowTypeImports: true, importNames: ['Grid'] }],
        },
        files: {
          'a.ts':
            "import type { Grid } from '@mui/material';\nimport { Button } from '@mui/material';",
        },
      },
    ],
    invalid: [
      {
        options: {
          packages: [
            { name: '@mui/material', importNames: ['Grid'], message: 'Use Stack.' },
            { name: 'old-ui*' },
          ],
        },
        files: {
          'a.ts':
            "import { Grid, Button } from '@mui/material/index.js';\nimport { X } from 'old-ui-kit';",
        },
        findings: [
          { path: 'a.ts', line: 1, message: 'Do not import Grid from @mui/material. Use Stack.' },
          { path: 'a.ts', line: 2, message: 'Do not import old-ui-kit.' },
        ],
      },
    ],
  },
  framework,
);

testRule(
  'boundaries/no-undeclared-dependency',
  noUndeclaredDependency,
  {
    valid: [
      {
        files: {
          'package.json': JSON.stringify({
            name: 'app',
            dependencies: { lib: '1' },
            devDependencies: { tool: '1', '@types/typed': '1' },
          }),
          'node_modules/lib/package.json': JSON.stringify({ name: 'lib' }),
          'node_modules/lib/index.js': '',
          'node_modules/tool/package.json': JSON.stringify({ name: 'tool' }),
          'node_modules/tool/index.js': '',
          'src/a.ts': "import 'lib';\nimport fs from 'node:fs';\nimport type { T } from 'typed';",
          'src/a.test.ts': "import 'tool';",
          'vite.config.ts': "import 'tool';",
        },
      },
    ],
    invalid: [
      {
        files: {
          'package.json': JSON.stringify({ name: 'root', private: true }),
          'packages/app/package.json': JSON.stringify({
            name: 'app',
            devDependencies: { tool: '1' },
          }),
          'packages/app/src/a.ts':
            "import { ui } from '@acme/ui';\nimport 'tool';\nimport 'not-installed';",
          'packages/ui/package.json': JSON.stringify({ name: '@acme/ui' }),
          'packages/ui/src/index.ts': 'export const ui = 1;',
        },
        findings: [
          {
            path: 'packages/app/src/a.ts',
            line: 1,
            message: '@acme/ui is not declared in packages/app/package.json.',
          },
          {
            path: 'packages/app/src/a.ts',
            line: 2,
            message: 'tool is not declared in packages/app/package.json.',
          },
          {
            path: 'packages/app/src/a.ts',
            line: 3,
            message: 'not-installed is not declared in packages/app/package.json.',
          },
        ],
      },
    ],
  },
  framework,
);

testRule(
  'boundaries/no-orphans',
  noOrphans,
  {
    invalid: [
      {
        config,
        options: { roots: ['src/main.ts'] },
        files: {
          'src/main.ts': "import { a } from './features/a/index.ts';",
          'src/features/a/index.ts': "import { used } from './used.ts';\nexport const a = used;",
          'src/features/a/used.ts': 'export const used = 1;',
          'src/features/a/unused.ts': 'export const unused = 1;',
          'src/features/a/unused.test.ts': "import { unused } from './unused.ts';",
          'src/global.d.ts': '',
        },
        findings: [
          {
            path: 'src/features/a/unused.ts',
            message: 'Nothing imports src/features/a/unused.ts.',
          },
        ],
      },
    ],
  },
  framework,
);
