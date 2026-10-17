import { describe, expect, it } from 'vite-plus/test';
import { cleanArchitecture } from '../src/index.ts';
import { check } from './check.ts';

const valid = {
  'package.json': JSON.stringify({ name: 'api', dependencies: { express: '^5' } }),
  'node_modules/express/package.json': JSON.stringify({ name: 'express', main: 'index.js' }),
  'node_modules/express/index.js': 'module.exports = {};',
  'src/main.ts': [
    "import { PostgresUsers } from './infrastructure/postgresUsers.ts';",
    "import { userRoutes } from './presentation/userRoutes.ts';",
  ].join('\n'),
  'src/domain/user.ts': 'export interface User { readonly id: string }',
  'src/application/registerUser.ts': [
    "import type { User } from '../domain/user.ts';",
    'export interface Users { save(user: User): Promise<void> }',
  ].join('\n'),
  'src/infrastructure/postgresUsers.ts': [
    "import { readFile } from 'node:fs/promises';",
    "import type { Users } from '../application/registerUser.ts';",
  ].join('\n'),
  'src/presentation/userRoutes.ts': [
    "import express from 'express';",
    "import { registerUser } from '../application/registerUser.ts';",
    'const port = process.env.PORT;',
  ].join('\n'),
};

describe('cleanArchitecture', () => {
  it('accepts dependencies that point inward', async () => {
    expect(await check([cleanArchitecture({ frameworks: ['express'] })], valid)).toEqual([]);
  });

  it('reports dependencies that point outward, and presentation that uses infrastructure', async () => {
    const findings = await check([cleanArchitecture()], {
      ...valid,
      'src/domain/user.ts': "import type { Users } from '../application/registerUser.ts';",
      'src/application/registerUser.ts':
        "import { PostgresUsers } from '../infrastructure/postgresUsers.ts';",
      'src/presentation/userRoutes.ts':
        "import { PostgresUsers } from '../infrastructure/postgresUsers.ts';",
    });
    expect(findings).toEqual([
      'src/application/registerUser.ts:1 boundaries/allowed-imports The layer src/application must not import the layer src/infrastructure.',
      'src/domain/user.ts:1 boundaries/allowed-imports The layer src/domain must not import the layer src/application.',
      'src/presentation/userRoutes.ts:1 boundaries/allowed-imports The layer src/presentation must not import the layer src/infrastructure.',
    ]);
  });

  it('reports I/O and frameworks in the domain and application layers', async () => {
    const findings = await check([cleanArchitecture({ frameworks: ['express'] })], {
      ...valid,
      'src/domain/user.ts': "import express from 'express';\nconst port = process.env.PORT;",
      'src/application/registerUser.ts':
        "import { readFile } from 'node:fs/promises';\nawait fetch('/users');",
    });
    expect(findings).toEqual([
      'src/application/registerUser.ts:1 boundaries/restricted-packages Do not import node:fs/promises. The domain and application layers do no I/O.',
      'src/application/registerUser.ts:2 boundaries/restricted-globals Do not use fetch. The domain and application layers do no I/O.',
      'src/domain/user.ts:1 boundaries/restricted-packages Do not import express. The domain and application layers do no I/O.',
      'src/domain/user.ts:2 boundaries/restricted-globals Do not use process. The domain and application layers do no I/O.',
    ]);
  });

  it('takes other layer names and a root per module', async () => {
    const findings = await check(
      [
        cleanArchitecture({
          root: 'src/modules/:module',
          layers: { domain: 'core', presentation: 'http' },
        }),
      ],
      {
        'src/modules/users/core/user.ts': "import { routes } from '../http/routes.ts';",
        'src/modules/users/http/routes.ts': "import type { User } from '../core/user.ts';",
        'src/modules/orders/core/order.ts': "import type { User } from '../../users/core/user.ts';",
      },
    );
    expect(findings).toEqual([
      'src/modules/users/core/user.ts:1 boundaries/allowed-imports The layer src/modules/users/core must not import the layer src/modules/users/http.',
    ]);
  });
});
