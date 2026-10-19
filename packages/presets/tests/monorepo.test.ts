import { describe, expect, it } from 'vite-plus/test';
import { monorepo } from '../src/index.ts';
import { check } from './check.ts';

const pkg = (name: string, dependencies: readonly string[] = []) =>
  JSON.stringify({
    name,
    dependencies: Object.fromEntries(dependencies.map((dependency) => [dependency, 'workspace:*'])),
  });

const valid = {
  'package.json': JSON.stringify({ name: 'root', private: true }),
  'apps/web/package.json': pkg('@acme/web', ['@acme/ui', '@acme/utils']),
  'apps/web/src/main.ts':
    "import { Button } from '@acme/ui';\nimport { format } from '@acme/utils';",
  'packages/ui/package.json': pkg('@acme/ui', ['@acme/utils']),
  'packages/ui/src/index.ts': "export { Button } from './button.ts';",
  'packages/ui/src/button.ts':
    "import { format } from '@acme/utils';\nexport const Button = format;",
  'packages/utils/package.json': pkg('@acme/utils'),
  'packages/utils/index.ts': 'export const format = 1;',
};

describe('monorepo', () => {
  it('accepts apps that use packages through their entry files', async () => {
    expect(await check([monorepo()], valid)).toEqual([]);
  });

  it('reports packages that import apps, and apps that import each other', async () => {
    const findings = await check([monorepo()], {
      ...valid,
      'apps/admin/package.json': pkg('@acme/admin', ['@acme/web']),
      'apps/admin/src/main.ts': "import { x } from '@acme/web';",
      'apps/web/src/index.ts': 'export const x = 1;',
      'apps/docs/package.json': pkg('@acme/docs'),
      'apps/docs/src/index.ts': 'export const docs = 1;',
      'packages/utils/package.json': pkg('@acme/utils', ['@acme/docs']),
      'packages/utils/index.ts': "import { docs } from '@acme/docs';\nexport const format = docs;",
    });
    expect(findings).toEqual([
      'apps/admin/src/main.ts:1 boundaries/allowed-imports The app apps/admin must not import the app apps/web.',
      'packages/utils/index.ts:1 boundaries/allowed-imports The package packages/utils must not import the app apps/docs.',
    ]);
  });

  it('reports imports past what a package exports, undeclared dependencies, and cycles', async () => {
    const findings = await check([monorepo()], {
      ...valid,
      'packages/ui/package.json': JSON.stringify({
        name: '@acme/ui',
        dependencies: { '@acme/utils': 'workspace:*' },
        exports: { '.': './src/index.ts' },
      }),
      'apps/web/src/main.ts': [
        "import { Button } from '@acme/ui/src/button.ts';",
        "import { format } from '../../../packages/utils/index.ts';",
      ].join('\n'),
      'packages/utils/index.ts': "import { Button } from '@acme/ui';\nexport const format = 1;",
    });
    expect(findings).toEqual([
      'apps/web/src/main.ts:1 boundaries/workspace-imports @acme/ui does not export ./src/button.ts.',
      'apps/web/src/main.ts:2 boundaries/workspace-imports Import @acme/utils by its package name, not by the path ../../../packages/utils/index.ts.',
      'packages/ui/src/button.ts:1 boundaries/no-cycles Dependency cycle: packages/ui -> packages/utils -> packages/ui.',
      'packages/utils/index.ts:1 boundaries/no-undeclared-dependency @acme/ui is not declared in packages/utils/package.json.',
    ]);
  });

  it('allows deep imports that a package exports, or of a package without exports', async () => {
    const findings = await check([monorepo({ apps: [], packages: 'libs/:name' })], {
      'libs/a/package.json': pkg('a', ['b', 'c']),
      'libs/a/main.ts':
        "import { b } from 'b';\nimport { x } from 'b/x.ts';\nimport { y } from 'c/src/y.ts';",
      'libs/b/package.json': JSON.stringify({
        name: 'b',
        exports: { '.': './main.ts', './*': './*' },
      }),
      'libs/b/main.ts': 'export const b = 1;',
      'libs/b/x.ts': 'export const x = 1;',
      'libs/c/package.json': JSON.stringify({ name: 'c' }),
      'libs/c/src/y.ts': 'export const y = 1;',
    });
    expect(findings).toEqual([]);
  });
});
