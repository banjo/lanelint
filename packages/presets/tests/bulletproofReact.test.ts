import { describe, expect, it } from 'vite-plus/test';
import { bulletproofReact } from '../src/index.ts';
import { check } from './check.ts';

const valid = {
  'src/app/router.tsx': [
    "import { DiscussionsList } from '../features/discussions/components/discussionsList.tsx';",
    "import { Comments } from '../features/comments/components/comments.tsx';",
  ].join('\n'),
  'src/features/discussions/components/discussionsList.tsx': [
    "import { Button } from '../../../components/button.tsx';",
    "import { useDisclosure } from '../../../hooks/useDisclosure.ts';",
    "import { api } from '../api/getDiscussions.ts';",
  ].join('\n'),
  'src/features/discussions/api/getDiscussions.ts':
    "import { client } from '../../../lib/apiClient.ts';",
  'src/features/comments/components/comments.tsx':
    "import type { User } from '../../../types/api.ts';",
  'src/components/button.tsx': "import { cn } from '../utils/cn.ts';",
  'src/hooks/useDisclosure.ts': 'export const useDisclosure = 1;',
  'src/lib/apiClient.ts': "import { env } from '../config/env.ts';",
  'src/config/env.ts': 'export const env = 1;',
  'src/types/api.ts': 'export interface User {}',
  'src/utils/cn.ts': 'export const cn = 1;',
};

describe('bulletproofReact', () => {
  it('accepts a project where code flows from shared code to features to the app', async () => {
    expect(await check([bulletproofReact()], valid)).toEqual([]);
  });

  it('reports cross-feature imports and imports against the flow', async () => {
    const findings = await check([bulletproofReact()], {
      ...valid,
      'src/features/comments/components/comments.tsx':
        "import { DiscussionsList } from '../../discussions/components/discussionsList.tsx';",
      'src/features/discussions/api/getDiscussions.ts':
        "import { router } from '../../../app/router.tsx';",
      'src/hooks/useDisclosure.ts':
        "import { Comments } from '../features/comments/components/comments.tsx';",
    });
    expect(findings).toEqual([
      'src/features/comments/components/comments.tsx:1 boundaries/allowed-imports The feature src/features/comments must not import the feature src/features/discussions.',
      'src/features/discussions/api/getDiscussions.ts:1 boundaries/allowed-imports The feature src/features/discussions must not import the app src/app.',
      'src/hooks/useDisclosure.ts:1 boundaries/allowed-imports The shared src/hooks must not import the feature src/features/comments.',
    ]);
  });

  it('gives hints that follow Bulletproof React', async () => {
    const findings = await check(
      [bulletproofReact()],
      {
        ...valid,
        'src/features/comments/components/comments.tsx':
          "import { DiscussionsList } from '../../discussions/components/discussionsList.tsx';",
      },
      { hints: true },
    );
    expect(findings).toEqual([
      'src/features/comments/components/comments.tsx:1 boundaries/allowed-imports The feature src/features/comments must not import the feature src/features/discussions. (Compose features in the app instead: import both there, and pass data or components down as props.)',
    ]);
  });

  it('treats stores and config as shared code', async () => {
    const findings = await check([bulletproofReact()], {
      ...valid,
      'src/stores/discussions.ts':
        "import { DiscussionsList } from '../features/discussions/components/discussionsList.tsx';",
      'src/config/routes.ts': "import { router } from '../app/router.tsx';",
    });
    expect(findings).toEqual([
      'src/config/routes.ts:1 boundaries/allowed-imports The shared src/config must not import the app src/app.',
      'src/stores/discussions.ts:1 boundaries/allowed-imports The shared src/stores must not import the feature src/features/discussions.',
    ]);
  });

  it('takes other shared directories', async () => {
    const findings = await check([bulletproofReact({ shared: ['ui'] })], {
      'src/app/app.tsx': "import { a } from '../features/a/index.ts';",
      'src/features/a/index.ts': "import { Button } from '../../ui/button.ts';",
      'src/ui/button.ts': "import { a } from '../features/a/index.ts';",
    });
    expect(findings).toEqual([
      'src/ui/button.ts:1 boundaries/allowed-imports The shared src/ui must not import the feature src/features/a.',
    ]);
  });
});
