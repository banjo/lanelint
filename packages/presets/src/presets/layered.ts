import { defineConfigFragment } from '@lanelint/core';
import boundaries from '@lanelint/plugin-boundaries';

export interface LayeredLayers {
  /** Globs of controller files. Defaults to `controllers/` directories and `*.controller.*` files. */
  readonly controllers?: readonly string[];
  /** Globs of service files. Defaults to `services/` directories and `*.service.*` files. */
  readonly services?: readonly string[];
  /** Globs of repository files. Defaults to `repositories/` directories and `*.repository.*` files. */
  readonly repositories?: readonly string[];
}

export interface LayeredOptions {
  readonly layers?: LayeredLayers;
}

/**
 * A layered backend: controllers call services, services call repositories, and no layer
 * imports a layer above it.
 */
export function layered(options: LayeredOptions = {}) {
  const controllers = {
    files: [...(options.layers?.controllers ?? ['**/controllers/**', '**/*.controller.*'])],
  };
  const services = {
    files: [...(options.layers?.services ?? ['**/services/**', '**/*.service.*'])],
  };
  const repositories = {
    files: [...(options.layers?.repositories ?? ['**/repositories/**', '**/*.repository.*'])],
  };

  return defineConfigFragment({
    plugins: [boundaries],
    rules: {
      'boundaries/allowed-imports': [
        'error',
        {
          rules: [
            {
              from: controllers,
              disallow: repositories,
              message: 'Controllers must not use repositories.',
              hint: 'Call a service that uses the repository.',
            },
            {
              from: services,
              disallow: controllers,
              message: 'Services must not import controllers.',
              hint: 'Move the code both need into the service, or into a file both may import.',
            },
            {
              from: repositories,
              disallow: [services, controllers],
              message: 'Repositories must not import services or controllers.',
              hint: 'Repositories only access data. Move the logic into a service.',
            },
          ],
        },
      ],
    },
  });
}
