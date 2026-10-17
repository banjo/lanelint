import { defineConfigFragment } from '@pilotlint/core';
import boundaries from '@pilotlint/plugin-boundaries';
import { PathUtil } from '../utils/pathUtil.ts';

export interface BulletproofReactOptions {
  /** The directory that holds `app`, `features`, and the shared directories. Defaults to `src`. */
  readonly root?: string;
  /** Directories of shared code. Defaults to `components`, `config`, `hooks`, `lib`, `stores`, `types`, and `utils`. */
  readonly shared?: readonly string[];
}

/**
 * Bulletproof React: code flows one way, from shared code to features to the app, and
 * features do not import each other.
 */
export function bulletproofReact(options: BulletproofReactOptions = {}) {
  const root = PathUtil.normalize(options.root ?? 'src');
  const shared = options.shared ?? [
    'components',
    'config',
    'hooks',
    'lib',
    'stores',
    'types',
    'utils',
  ];

  return defineConfigFragment({
    plugins: [boundaries],
    elements: [
      {
        type: 'feature',
        pattern: PathUtil.join(root, 'features', ':feature'),
        description:
          'A feature module. It may import shared code, but not other features or the app. Compose features in the app.',
      },
      {
        type: 'app',
        pattern: PathUtil.join(root, 'app'),
        description:
          'The application layer: routes, providers, and the router. It composes features.',
      },
      {
        type: 'shared',
        pattern: PathUtil.join(root, ':name'),
        where: { name: [...shared] },
        description: 'Shared code that any part may use. It must not import features or the app.',
      },
    ],
    rules: {
      'boundaries/allowed-imports': [
        'error',
        {
          rules: [
            {
              from: 'feature',
              disallow: 'feature',
              hint: 'Compose features in the app instead: import both there, and pass data or components down as props.',
            },
            {
              from: 'feature',
              disallow: 'app',
              hint: 'Move what the feature needs into shared code, or pass it in from the app.',
            },
            {
              from: 'shared',
              disallow: ['feature', 'app'],
              hint: 'Move this code into the feature, or pass what it needs in as an argument.',
            },
          ],
        },
      ],
    },
  });
}
