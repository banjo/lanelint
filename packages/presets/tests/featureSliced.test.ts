import { describe, expect, it } from 'vite-plus/test';
import { featureSliced, monorepo } from '../src/index.ts';
import { check } from './check.ts';

const valid = {
  'src/app/index.ts': "import { HomePage } from '../pages/home/index.ts';",
  'src/app/providers/store.ts': "import { client } from '../../shared/api/client.ts';",
  'src/pages/home/index.ts': "export { HomePage } from './ui/homePage.ts';",
  'src/pages/home/ui/homePage.ts': [
    "import { Header } from '../../../widgets/header/index.ts';",
    "import { Like } from '../../../features/like/index.ts';",
    "import { Song } from '../../../entities/song/index.ts';",
    "import { Button } from '../../../shared/ui/button.ts';",
  ].join('\n'),
  'src/widgets/header/index.ts': "import { Like } from '../../features/like/index.ts';",
  'src/features/like/index.ts': "export { like } from './model/like.ts';",
  'src/features/like/model/like.ts': "import { Song } from '../../../entities/song/index.ts';",
  'src/entities/artist/index.ts': "export type { Artist } from './model/artist.ts';",
  'src/entities/artist/model/artist.ts': "import type { Song } from '../../song/@x/artist.ts';",
  'src/entities/song/index.ts': "export type { Song } from './model/song.ts';",
  'src/entities/song/@x/artist.ts': "export type { Song } from '../model/song.ts';",
  'src/entities/song/model/song.ts': 'export interface Song {}',
  'src/shared/ui/button.ts': 'export const Button = 1;',
  'src/shared/api/client.ts': "import { Button } from '../ui/button.ts';",
};

describe('featureSliced', () => {
  it('accepts a project that follows Feature-Sliced Design', async () => {
    expect(await check([featureSliced()], valid)).toEqual([]);
  });

  it('reports imports of higher layers and of other slices on the same layer', async () => {
    const findings = await check([featureSliced()], {
      ...valid,
      'src/shared/lib/song.ts': "import { Song } from '../../entities/song/index.ts';",
      'src/entities/song/model/song.ts':
        "import { Header } from '../../../widgets/header/index.ts';",
      'src/features/comment/index.ts': "import { like } from '../like/index.ts';",
    });
    expect(findings).toEqual([
      'src/entities/song/model/song.ts:1 boundaries/allowed-imports The slice src/entities/song must not import the slice src/widgets/header.',
      'src/features/comment/index.ts:1 boundaries/allowed-imports The slice src/features/comment must not import the slice src/features/like.',
      'src/shared/lib/song.ts:1 boundaries/allowed-imports The layer src/shared must not import the slice src/entities/song.',
    ]);
  });

  it('allows @x files only for other entities', async () => {
    const findings = await check([featureSliced()], {
      ...valid,
      'src/entities/artist/model/artist.ts':
        "import type { Song } from '../../song/model/song.ts';",
      'src/features/like/model/like.ts':
        "import type { Song } from '../../../entities/song/@x/artist.ts';",
    });
    expect(findings).toEqual([
      'src/entities/artist/model/artist.ts:1 boundaries/allowed-imports The slice src/entities/artist must not import the slice src/entities/song.',
      'src/entities/artist/model/artist.ts:1 boundaries/entry-only Import src/entities/song through its entry file, not src/entities/song/model/song.ts.',
      'src/features/like/model/like.ts:1 boundaries/allowed-imports Only other entities may import @x files.',
    ]);
  });

  it('requires the public API from outside a slice and relative imports inside it', async () => {
    const findings = await check([featureSliced()], {
      ...valid,
      'src/pages/home/ui/homePage.ts':
        "import { like } from '../../../features/like/model/like.ts';",
      'src/features/like/model/like.ts': "import { like } from '../index.ts';",
    });
    expect(findings).toEqual([
      'src/features/like/model/like.ts:1 boundaries/no-entry-import Import files of src/features/like directly, not its own entry file src/features/like/index.ts.',
      'src/pages/home/ui/homePage.ts:1 boundaries/entry-only Import src/features/like through its entry file, not src/features/like/model/like.ts.',
    ]);
  });

  it('works in each app of a monorepo', async () => {
    const files = Object.fromEntries(
      Object.entries(valid).map(([path, content]) => [`apps/web/${path}`, content]),
    );
    const findings = await check([monorepo(), featureSliced({ root: 'apps/:app/src' })], {
      ...files,
      'apps/web/package.json': '{ "name": "web" }',
      'packages/ui/package.json': '{ "name": "ui" }',
      'packages/ui/src/index.ts': 'export const ui = 1;',
      'apps/web/src/features/comment/index.ts': "import { like } from '../like/index.ts';",
    });
    expect(findings).toEqual([
      'apps/web/src/features/comment/index.ts:1 boundaries/allowed-imports The slice apps/web/src/features/comment must not import the slice apps/web/src/features/like.',
    ]);
  });
});
