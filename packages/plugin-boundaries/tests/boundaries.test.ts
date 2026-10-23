import { describe, expect, it } from 'vite-plus/test';
import { testRule } from '@lanelint/core/testing';
import {
  allowedImports,
  entryOnly,
  noCycles,
  noEntryImport,
  noOrphans,
  noUndeclaredDependency,
  noUnresolved,
  publicApi,
  restrictedGlobals,
  restrictedPackages,
  workspaceImports,
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
            message: 'The shared src/hooks must not import the feature src/features/a.',
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
              hint: 'Import src/features/<name>/index.ts.',
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
            hint: 'Import src/features/<name>/index.ts.',
          },
        ],
      },
      {
        name: 'file selectors inside one element',
        config,
        options: {
          rules: [
            { from: 'feature', disallow: 'feature' },
            { from: { files: '**/ui/**' }, disallow: { files: '**/db/**' } },
          ],
        },
        files: {
          'src/features/a/ui/page.ts':
            "import { query } from '../db/query.ts';\nimport { b } from '../model/b.ts';",
          'src/features/a/db/query.ts': 'export const query = 1;',
          'src/features/a/model/b.ts': 'export const b = 1;',
        },
        findings: [
          {
            path: 'src/features/a/ui/page.ts',
            line: 1,
            message: 'src/features/a/ui/page.ts must not import src/features/a/db/query.ts.',
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
      {
        name: 'node builtins, only in some files',
        options: {
          packages: [
            {
              name: 'node:{fs,child_process}',
              from: { files: '**/utils/**' },
              message: 'Utils are pure functions.',
            },
          ],
        },
        files: {
          'src/utils/pathUtil.ts':
            "import { readFileSync } from 'fs';\nimport { join } from 'node:path';",
          'src/services/fileService.ts': "import { readFileSync } from 'node:fs';",
        },
        findings: [
          {
            path: 'src/utils/pathUtil.ts',
            line: 1,
            message: 'Do not import node:fs. Utils are pure functions.',
          },
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
      {
        name: 'test files may use dev tools from the root package.json',
        files: {
          'package.json': JSON.stringify({ name: 'root', devDependencies: { vitest: '1' } }),
          'node_modules/vitest/package.json': JSON.stringify({ name: 'vitest' }),
          'node_modules/vitest/index.js': '',
          'packages/app/package.json': JSON.stringify({ name: 'app' }),
          'packages/app/src/a.test.ts': "import { it } from 'vitest';",
          'packages/app/vitest.config.ts': "import 'vitest';",
        },
      },
    ],
    invalid: [
      {
        name: 'code that is not a test may not use root dev tools, nor tests with allowRootDev off',
        options: { allowRootDev: false },
        files: {
          'package.json': JSON.stringify({ name: 'root', devDependencies: { vitest: '1' } }),
          'node_modules/vitest/package.json': JSON.stringify({ name: 'vitest' }),
          'node_modules/vitest/index.js': '',
          'packages/app/package.json': JSON.stringify({ name: 'app' }),
          'packages/app/src/a.test.ts': "import { it } from 'vitest';",
          'packages/app/src/a.ts': "import { it } from 'vitest';",
        },
        findings: [
          {
            path: 'packages/app/src/a.test.ts',
            message: 'vitest is not declared in packages/app/package.json.',
          },
          {
            path: 'packages/app/src/a.ts',
            message: 'vitest is not declared in packages/app/package.json.',
          },
        ],
      },
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

testRule(
  'boundaries/restricted-globals',
  restrictedGlobals,
  {
    valid: [
      {
        name: 'local names, properties, types, and other files',
        options: {
          globals: [
            { name: 'fetch', from: { files: '**/utils/**' } },
            { name: 'Date.now', from: { files: '**/utils/**' } },
          ],
        },
        files: {
          'src/utils/a.ts': [
            'export const load = (fetch: () => string) => fetch();',
            'const client = { fetch: 1 };',
            'export const value = client.fetch;',
            'export type Loader = typeof fetch;',
            'const Date = { now: () => 0 };',
            'export const time = Date.now();',
          ].join('\n'),
          'src/services/b.ts': 'export const load = () => fetch("/api");',
        },
      },
    ],
    invalid: [
      {
        options: {
          globals: [
            {
              name: 'fetch',
              message: 'Utils are pure functions.',
              hint: 'Call fetch from a service.',
            },
            { name: 'process' },
            { name: 'Date.now' },
            { name: 'Math.random' },
          ],
        },
        files: {
          'src/utils/a.ts': [
            'export const load = () => fetch("/api");',
            'export const env = process.env.NODE_ENV;',
            'export const stamp = () => [Date.now(), Math.random()];',
            'export const other = globalThis.fetch;',
          ].join('\n'),
        },
        findings: [
          {
            path: 'src/utils/a.ts',
            line: 1,
            message: 'Do not use fetch. Utils are pure functions.',
            hint: 'Call fetch from a service.',
          },
          { path: 'src/utils/a.ts', line: 2, message: 'Do not use process.' },
          { path: 'src/utils/a.ts', line: 3, message: 'Do not use Date.now.' },
          { path: 'src/utils/a.ts', line: 3, message: 'Do not use Math.random.' },
          {
            path: 'src/utils/a.ts',
            line: 4,
            message: 'Do not use fetch. Utils are pure functions.',
          },
        ],
      },
    ],
  },
  framework,
);

const workspace = {
  'package.json': JSON.stringify({ name: 'root', private: true }),
  'packages/app/package.json': JSON.stringify({
    name: 'app',
    dependencies: { '@acme/ui': '1', '@acme/lib': '1', '@acme/sugar': '1' },
  }),
  'packages/ui/package.json': JSON.stringify({
    name: '@acme/ui',
    exports: {
      '.': './src/index.ts',
      './icons': './src/icons/index.ts',
      './components/*': './src/components/*.ts',
      './components/internal': null,
    },
  }),
  'packages/ui/src/index.ts': 'export const ui = 1;',
  'packages/ui/src/icons/index.ts': 'export const icon = 1;',
  'packages/ui/src/components/button.ts': 'export const button = 1;',
  'packages/ui/src/components/internal.ts': 'export const internal = 1;',
  'packages/ui/src/private.ts': 'export const secret = 1;',
  'packages/lib/package.json': JSON.stringify({ name: '@acme/lib' }),
  'packages/lib/src/index.ts': 'export const lib = 1;',
  'packages/lib/src/date.ts': 'export const date = 1;',
  'packages/sugar/package.json': JSON.stringify({
    name: '@acme/sugar',
    exports: { import: './src/index.ts' },
  }),
  'packages/sugar/src/index.ts': 'export const sugar = 1;',
  'packages/sugar/src/inner.ts': 'export const inner = 1;',
  'packages/lib/auth/package.json': JSON.stringify({ name: '@acme/lib-auth' }),
  'packages/lib/auth/session.ts':
    "import { date } from '../src/date.ts';\nexport const session = date;",
};

testRule(
  'boundaries/workspace-imports',
  workspaceImports,
  {
    valid: [
      {
        name: 'names and exported subpaths, deep imports of packages without exports',
        files: {
          ...workspace,
          'packages/app/src/a.ts': [
            "import { ui } from '@acme/ui';",
            "import { icon } from '@acme/ui/icons';",
            "import { button } from '@acme/ui/components/button';",
            "import { date } from '@acme/lib/src/date';",
            "import { sugar } from '@acme/sugar';",
            "import { session } from '@acme/lib/auth/session';",
          ].join('\n'),
          'packages/ui/src/components/button.ts': "import { secret } from '../private.ts';",
          'packages/app/src/a.test.ts': "import { secret } from '../../ui/src/private.ts';",
          'packages/lib/src/index.ts': "import { session } from '../auth/session.ts';",
        },
      },
    ],
    invalid: [
      {
        name: 'relative paths into other packages, and subpaths that are not exported',
        files: {
          ...workspace,
          'packages/app/src/a.ts': [
            "import { secret } from '../../ui/src/private.ts';",
            "import { secret as s } from '@acme/ui/src/private';",
            "import { internal } from '@acme/ui/components/internal';",
            "import { inner } from '@acme/sugar/src/inner';",
          ].join('\n'),
          'scripts/seed.ts': "import { date } from '../packages/lib/src/date.ts';",
        },
        findings: [
          {
            path: 'packages/app/src/a.ts',
            line: 1,
            message:
              'Import @acme/ui by its package name, not by the path ../../ui/src/private.ts.',
            hint: 'Import from "@acme/ui", or a subpath that packages/ui/package.json exports.',
          },
          {
            path: 'packages/app/src/a.ts',
            line: 2,
            message: '@acme/ui does not export ./src/private.',
            hint: 'Import from a subpath that packages/ui/package.json exports (., ./icons, ./components/*), or add ./src/private to its exports.',
          },
          {
            path: 'packages/app/src/a.ts',
            line: 3,
            message: '@acme/ui does not export ./components/internal.',
          },
          {
            path: 'packages/app/src/a.ts',
            line: 4,
            message: '@acme/sugar does not export ./src/inner.',
          },
          {
            path: 'scripts/seed.ts',
            message:
              'Import @acme/lib by its package name, not by the path ../packages/lib/src/date.ts.',
          },
        ],
      },
    ],
  },
  framework,
);
