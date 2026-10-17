import { defineConfigFragment } from '@pilotlint/core';
import boundaries, { type Selector } from '@pilotlint/plugin-boundaries';
import { IO_BUILTINS, IO_GLOBALS } from '../constants/io.ts';
import { PathUtil } from '../utils/pathUtil.ts';

export interface CleanArchitectureLayers {
  readonly domain?: string;
  readonly application?: string;
  readonly infrastructure?: string;
  readonly presentation?: string;
}

export interface CleanArchitectureOptions {
  /** The directory that holds the layers. It can have captures, such as `src/modules/:module`. Defaults to `src`. */
  readonly root?: string;
  /** Directory names of the layers. Defaults to `domain`, `application`, `infrastructure`, and `presentation`. */
  readonly layers?: CleanArchitectureLayers;
  /** Packages that only the outer layers may import, such as `express` or `@prisma/client`. */
  readonly frameworks?: readonly string[];
}

/**
 * Clean Architecture: dependencies point inward, from presentation and infrastructure to
 * application to domain, and the inner layers do no I/O.
 */
export function cleanArchitecture(options: CleanArchitectureOptions = {}) {
  const root = PathUtil.normalize(options.root ?? 'src');
  const names = {
    domain: options.layers?.domain ?? 'domain',
    application: options.layers?.application ?? 'application',
    infrastructure: options.layers?.infrastructure ?? 'infrastructure',
    presentation: options.layers?.presentation ?? 'presentation',
  };
  const layer = (...keys: (keyof typeof names)[]): Selector => ({
    type: 'layer',
    captures: { layer: keys.map((key) => names[key]) },
  });
  const inner = layer('domain', 'application');
  const io = {
    from: inner,
    message: 'The domain and application layers do no I/O.',
    hint: 'Define an interface in the application layer, and implement it in infrastructure.',
  };
  const element = (key: keyof typeof names, description: string) => ({
    type: 'layer',
    pattern: PathUtil.join(root, ':layer'),
    where: { layer: [names[key]] },
    description,
  });

  const inward =
    'Define an interface in the inner layer, implement it in the outer layer, and connect them outside the layers, for example in main.ts.';
  return defineConfigFragment({
    plugins: [boundaries],
    elements: [
      element('domain', 'Business entities and rules. It depends on nothing else.'),
      element(
        'application',
        'Use cases, and the interfaces they need from the outside. It depends only on the domain.',
      ),
      element(
        'infrastructure',
        'Implementations of the application interfaces: databases, APIs, and files.',
      ),
      element(
        'presentation',
        'Controllers, handlers, and UI. It calls use cases in the application layer.',
      ),
    ],
    rules: {
      'boundaries/allowed-imports': [
        'error',
        {
          rules: [
            {
              from: layer('domain'),
              disallow: layer('application', 'infrastructure', 'presentation'),
              hint: inward,
            },
            {
              from: layer('application'),
              disallow: layer('infrastructure', 'presentation'),
              hint: inward,
            },
            {
              from: layer('infrastructure'),
              disallow: layer('presentation'),
              hint: 'Move the code both need into the application layer.',
            },
            {
              from: layer('presentation'),
              disallow: layer('infrastructure'),
              hint: 'Call a use case in the application layer, and connect infrastructure outside the layers, for example in main.ts.',
            },
          ],
        },
      ],
      'boundaries/restricted-packages': [
        'error',
        {
          packages: [IO_BUILTINS, ...(options.frameworks ?? [])].map((name) => ({ name, ...io })),
        },
      ],
      'boundaries/restricted-globals': [
        'error',
        { globals: IO_GLOBALS.map((name) => ({ name, ...io })) },
      ],
    },
  });
}
