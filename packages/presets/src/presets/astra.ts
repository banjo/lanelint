import { defineConfigFragment } from '@pilotlint/core';
import boundaries, { type Selector } from '@pilotlint/plugin-boundaries';
import { IO_BUILTINS, IO_GLOBALS } from '../constants/io.ts';
import { PathUtil } from '../utils/pathUtil.ts';

export interface AstraRoles {
  /** Globs of components: dumb, display-only React components. Defaults to `components/` directories. */
  readonly components?: readonly string[];
  /** Globs of constants. Defaults to `constants/` directories. */
  readonly constants?: readonly string[];
  /** Globs of containers: smart components that use hooks. Defaults to `containers/` directories. */
  readonly containers?: readonly string[];
  /** Globs of React contexts and their providers. Defaults to `contexts/` directories. */
  readonly contexts?: readonly string[];
  /** Globs of hooks. Defaults to `hooks/` directories. */
  readonly hooks?: readonly string[];
  /** Globs of mappers between models. Defaults to `mappers/` directories. */
  readonly mappers?: readonly string[];
  /** Globs of models. Defaults to `models/` directories. */
  readonly models?: readonly string[];
  /** Globs of services: logic with side effects. Defaults to `services/` directories. */
  readonly services?: readonly string[];
  /** Globs of utils: pure functions. Defaults to `utils/` directories. */
  readonly utils?: readonly string[];
}

export interface AstraOptions {
  /** The directory that holds `features/` and `common/`. It can have captures, such as `apps/:app/src`. Defaults to `src`. */
  readonly root?: string;
  readonly roles?: AstraRoles;
}

type Role = keyof AstraRoles;

const NETWORK_GLOBALS = ['fetch', 'XMLHttpRequest', 'WebSocket'];

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** `a`, `a or b`, or `a, b, or c`. */
const either = (words: readonly string[]) =>
  words.length < 3
    ? words.join(' or ')
    : `${words.slice(0, -1).join(', ')}, or ${words.at(-1) ?? ''}`;

/**
 * Astra: features and common domains are used through the files their index file exports,
 * and every feature and domain has the same role directories. Models, mappers, constants,
 * and utils are pure, services have the side effects, hooks and contexts hold the React
 * logic, containers coordinate hooks, and components only display.
 */
export function astra(options: AstraOptions = {}) {
  const root = PathUtil.normalize(options.root ?? 'src');
  const role = (name: Role): Selector => ({
    files: [...(options.roles?.[name] ?? [`**/${name}/**`])],
  });
  const roleRule = (from: Role, disallow: readonly Role[], hint: string) => ({
    from: role(from),
    disallow: disallow.map(role),
    message: `${capitalize(from)} must not import ${either(disallow)}.`,
    hint,
  });
  const pure = ['constants', 'mappers', 'models', 'utils'] as const;
  const react = ['hooks', 'contexts', 'components', 'containers'] as const;
  const pureIo = {
    from: pure.map(role),
    message: 'Constants, mappers, models, and utils are pure.',
    hint: 'Move the code with side effects to a service.',
  };

  return defineConfigFragment({
    plugins: [boundaries],
    elements: [
      {
        type: 'feature',
        pattern: PathUtil.join(root, 'features', ':feature'),
        description:
          'A user-facing feature with role directories such as components, hooks, and services. Other code imports only files its index.ts exports.',
      },
      {
        type: 'domain',
        pattern: PathUtil.join(root, 'common', ':domain'),
        description:
          'Shared code of one business domain, with the same role directories. It must not import features. Other code imports only files its index.ts exports.',
      },
    ],
    rules: {
      'boundaries/allowed-imports': [
        'error',
        {
          rules: [
            ...pure.map((name) =>
              roleRule(
                name,
                ['services', ...react],
                `${capitalize(name)} are pure. Pass what they need in as arguments, or move the code to a service or a hook.`,
              ),
            ),
            roleRule(
              'services',
              react,
              'Services do not know about React. Call the service from a hook instead.',
            ),
            roleRule(
              'hooks',
              ['components', 'containers'],
              'Hooks return data and callbacks. Render components in a container.',
            ),
            roleRule(
              'contexts',
              ['components', 'containers'],
              'Contexts provide data and callbacks. Render components in a container.',
            ),
            roleRule(
              'components',
              ['containers', 'hooks', 'contexts', 'services', 'mappers'],
              'Components only display data. Take it as props, and get it in a container through a hook.',
            ),
            roleRule(
              'containers',
              ['services', 'mappers'],
              'Call the service in a hook, and use the hook in the container.',
            ),
            {
              from: 'domain',
              disallow: 'feature',
              message: 'Common code must not import features.',
              hint: 'Move the code into the feature, or pass what it needs in as an argument.',
            },
          ],
        },
      ],
      'boundaries/public-api': ['error', { elements: ['feature', 'domain'] }],
      'boundaries/no-entry-import': [
        'error',
        {
          rules: [
            { from: ['feature', 'domain'], to: 'self' },
            {
              from: ['feature', 'domain'],
              to: ['feature', 'domain'],
              message:
                'Import the file you need, not the index.ts, which loads the whole feature or domain.',
            },
          ],
        },
      ],
      'boundaries/no-cycles': ['error', { elements: ['feature', 'domain'] }],
      'boundaries/restricted-packages': [
        'error',
        {
          packages: [
            { name: IO_BUILTINS, ...pureIo },
            {
              name: '{react,react-dom}',
              allowTypeImports: true,
              from: [...pure, 'services' as const].map(role),
              message: 'React code belongs in hooks, contexts, components, and containers.',
              hint: 'Move the React code to a hook, and keep this file plain TypeScript.',
            },
          ],
        },
      ],
      'boundaries/restricted-globals': [
        'error',
        {
          globals: [
            ...IO_GLOBALS.map((name) => ({ name, ...pureIo })),
            ...NETWORK_GLOBALS.map((name) => ({
              name,
              from: react.map(role),
              message: 'API calls belong in services.',
              hint: 'Move the call to a service, and call the service from a hook.',
            })),
          ],
        },
      ],
    },
  });
}
