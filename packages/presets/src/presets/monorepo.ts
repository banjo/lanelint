import { defineConfigFragment } from '@pilotlint/core';
import boundaries from '@pilotlint/plugin-boundaries';
import { PathUtil } from '../utils/pathUtil.ts';

export interface MonorepoOptions {
  /** Directory patterns of apps. Defaults to `apps/:name`. Use `[]` for a repository without apps. */
  readonly apps?: string | readonly string[];
  /** Directory patterns of packages. Defaults to `packages/:name`. */
  readonly packages?: string | readonly string[];
}

/**
 * A monorepo with apps and packages: apps use packages, packages never use apps, and packages
 * are imported by name, through what they export, and declared as dependencies.
 */
export function monorepo(options: MonorepoOptions = {}) {
  const apps = PathUtil.toList(options.apps ?? 'apps/:name');

  return defineConfigFragment({
    plugins: [boundaries],
    elements: [
      ...PathUtil.toList(options.packages ?? 'packages/:name').map((pattern) => ({
        type: 'package',
        pattern,
        description:
          'A workspace package. Other code imports it by name, through what its package.json exports, and declares it as a dependency.',
      })),
      ...apps.map((pattern) => ({
        type: 'app',
        pattern,
        description: 'A deployable app. It may use packages, but no other code may import it.',
      })),
    ],
    rules: {
      'boundaries/allowed-imports': [
        'error',
        {
          rules: apps.length
            ? [
                {
                  from: 'package',
                  disallow: 'app',
                  hint: 'Move the code both need into a package.',
                },
                {
                  from: 'app',
                  disallow: 'app',
                  hint: 'Move the code both apps need into a package.',
                },
              ]
            : [],
        },
      ],
      'boundaries/no-cycles': 'error',
      'boundaries/no-undeclared-dependency': 'error',
      'boundaries/workspace-imports': 'error',
    },
  });
}
