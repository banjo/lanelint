import { describe, expect, it } from 'vite-plus/test';
import { layered, monorepo } from '../src/index.ts';
import { check } from './check.ts';

const valid = {
  'src/controllers/userController.ts': "import { getUser } from '../services/userService.ts';",
  'src/services/userService.ts': [
    "import { findUser } from '../repositories/userRepository.ts';",
    "import type { User } from '../models/user.ts';",
  ].join('\n'),
  'src/repositories/userRepository.ts': "import type { User } from '../models/user.ts';",
  'src/models/user.ts': 'export interface User {}',
  'src/orders/orders.controller.ts': "import { OrdersService } from './orders.service.ts';",
  'src/orders/orders.service.ts': "import { OrdersRepository } from './orders.repository.ts';",
  'src/orders/orders.repository.ts': 'export class OrdersRepository {}',
};

describe('layered', () => {
  it('accepts controllers that call services that call repositories', async () => {
    expect(await check([layered()], valid)).toEqual([]);
  });

  it('reports skipped and upward imports, in directories and by file suffix', async () => {
    const findings = await check([layered()], {
      ...valid,
      'src/controllers/userController.ts':
        "import { findUser } from '../repositories/userRepository.ts';",
      'src/repositories/userRepository.ts': "import { getUser } from '../services/userService.ts';",
      'src/orders/orders.service.ts': "import { OrdersController } from './orders.controller.ts';",
    });
    expect(findings).toEqual([
      'src/controllers/userController.ts:1 boundaries/allowed-imports Controllers must not use repositories.',
      'src/orders/orders.service.ts:1 boundaries/allowed-imports Services must not import controllers.',
      'src/repositories/userRepository.ts:1 boundaries/allowed-imports Repositories must not import services or controllers.',
    ]);
  });

  it('takes other globs for the layers', async () => {
    const findings = await check([layered({ layers: { controllers: ['src/handlers/**'] } })], {
      'src/handlers/user.ts': "import { find } from '../repositories/user.ts';",
      'src/repositories/user.ts': 'export const find = 1;',
    });
    expect(findings).toEqual([
      'src/handlers/user.ts:1 boundaries/allowed-imports Controllers must not use repositories.',
    ]);
  });

  it('checks the layers inside an app of a monorepo', async () => {
    const files = Object.fromEntries(
      Object.entries(valid).map(([path, content]) => [`apps/api/${path}`, content]),
    );
    const findings = await check([monorepo(), layered()], {
      ...files,
      'packages/db/package.json': '{ "name": "db" }',
      'packages/db/index.ts': 'export const db = 1;',
      'apps/api/src/orders/orders.controller.ts':
        "import { OrdersRepository } from './orders.repository.ts';",
    });
    expect(findings).toEqual([
      'apps/api/src/orders/orders.controller.ts:1 boundaries/allowed-imports Controllers must not use repositories.',
    ]);
  });
});
