# Astra

Checks a feature-layered frontend. Features and common domains are used through the files
their `index.ts` exports, and each has the same role directories, where each role may import
only the roles below it. Models, mappers, constants, and utils are pure, services have the
side effects, hooks and contexts hold the React logic, containers coordinate hooks, and
components only display.

```ts
import { astra } from '@pilotlint/presets';

export default defineConfig({
  extends: [astra()],
});
```

## Structure

```
src/
  features/
    user/
      index.ts      the public API of the feature
      components/   UserCard.tsx               dumb components: display only, data from props
      constants/    userConstants.ts           constant values
      containers/   UserListContainer.tsx      smart components: use hooks, render components
      contexts/     UserContext.tsx            React contexts and their providers
      hooks/        useUser.ts                 React logic, and queries that call services
                    useUserQuery.ts
      mappers/      UserMapper.ts              map between models, such as a DTO and User
      models/       User.ts                    the User type, and User.from(dto)
      services/     UserService.ts             side effects: API calls, stores, logging
                    __tests__/UserService.test.ts
      utils/        UserUtil.ts                pure functions
                    __tests__/UserUtil.test.ts
    vehicle/
      ...
  common/
    date/           shared code of one business domain, with the same roles
      index.ts
      utils/        DateUtil.ts
```

The roles are found by directory name anywhere in the project, so they apply in features and
in common domains alike. Tests in `__tests__/` directories are not checked by the import
rules, so they may import any file.

## Rules

**Features and common domains**

- **The `index.ts` declares the public API, and other code imports the files it exports.**
  A container that another feature uses is imported from
  `features/user/containers/UserListContainer.tsx`, and must be exported from
  `features/user/index.ts`. Importing files instead of the `index.ts` means a test loads
  only what it uses, not everything the feature exports.
- **Features and domains do not import an `index.ts`**, their own or another one. The
  `index.ts` is for code outside them, such as the app or the package exports.
- **Features and domains do not import each other in a cycle.**
- **Common domains do not import features.**

**Roles**

| Role                              | Must not import                                   |
| --------------------------------- | ------------------------------------------------- |
| constants, mappers, models, utils | services, hooks, contexts, components, containers |
| services                          | hooks, contexts, components, containers           |
| hooks, contexts                   | components, containers                            |
| components                        | containers, hooks, contexts, services, mappers    |
| containers                        | services, mappers (they call them through a hook) |

- **Constants, mappers, models, and utils are pure.** They do not import Node I/O modules or
  use `fetch`, `localStorage`, `window`, `document`, `process`, and similar globals.
- **Only hooks, contexts, components, and containers use React.** The other roles do not
  import `react` or `react-dom`, except for types.
- **API calls belong in services.** Hooks, contexts, components, and containers do not use
  `fetch`, `XMLHttpRequest`, or `WebSocket`.

The roles apply across features too: a util in `vehicle/` may not import a service in
`user/`, even when `user/index.ts` exports it.

## Splitting features

Features are flat: there are no sub-features. Split a large feature into features by
workflow, and move what they share to a common domain:

```
src/
  features/
    booking/          the booking list and details
    booking-create/   the create flow
    booking-move/     the move flow
  common/
    booking/          the Booking model, BookingUtil, and shared booking UI
```

The prefix keeps related features next to each other.

## Options

| Option             | Default                | Description                                                                                        |
| ------------------ | ---------------------- | -------------------------------------------------------------------------------------------------- |
| `root`             | `'src'`                | The directory that holds `features/` and `common/`. It can have captures, such as `apps/:app/src`. |
| `roles.components` | `['**/components/**']` | Globs of component files.                                                                          |
| `roles.constants`  | `['**/constants/**']`  | Globs of constant files.                                                                           |
| `roles.containers` | `['**/containers/**']` | Globs of container files.                                                                          |
| `roles.contexts`   | `['**/contexts/**']`   | Globs of context files.                                                                            |
| `roles.hooks`      | `['**/hooks/**']`      | Globs of hook files.                                                                               |
| `roles.mappers`    | `['**/mappers/**']`    | Globs of mapper files.                                                                             |
| `roles.models`     | `['**/models/**']`     | Globs of model files.                                                                              |
| `roles.services`   | `['**/services/**']`   | Globs of service files.                                                                            |
| `roles.utils`      | `['**/utils/**']`      | Globs of util files.                                                                               |

```ts
astra({ roles: { services: ['**/services/**', '**/api/**'] } });
```

## Naming

Like every preset, Astra checks structure only. These rules from
`@pilotlint/plugin-conventions` add the naming that usually goes with it:

- A file is named after what it exports: `UserService.ts` exports the `UserService` object,
  `useUser.ts` the `useUser` hook, and `UserCard.tsx` the `UserCard` component. Code reads
  `UserService.getUser()` and `UserUtil.getInitials()`. Model files may export only types,
  and constants files any number of constants.
- Each role has its name pattern, such as `*Service.ts` in `services/` and `use*.ts` in
  `hooks/`.
- Tests are in `__tests__/`, named after what they test, such as
  `services/__tests__/UserService.test.ts`.
- Features and domains have only the role directories, named in the plural, plus
  `__tests__/`. No `types/`, `lib/`, `helpers/`, `tests/`, or singular role directories such
  as `service/` anywhere.
- No `types.ts`: types go in named files in `models/`. No catch-all `utils.ts` or
  `helpers.ts`, and no `index.tsx` components.
- One `index.ts` per feature and domain, at its root, and no other files there.
- kebab-case directories, such as `features/user-profile/`.
- Named exports only, except in stories.

```ts
import boundaries from '@pilotlint/plugin-boundaries';
import conventions from '@pilotlint/plugin-conventions';
import { astra } from '@pilotlint/presets';
import { defineConfig } from 'pilotlint';

const roles = [
  'components',
  'constants',
  'containers',
  'contexts',
  'hooks',
  'mappers',
  'models',
  'services',
  'utils',
];

export default defineConfig({
  plugins: [conventions],
  extends: [boundaries.configs.recommended, astra()],
  rules: {
    'conventions/allowed-directories': [
      'error',
      {
        rules: [
          { directory: 'src/features/*', names: [...roles, '__tests__'] },
          { directory: 'src/common/*', names: [...roles, '__tests__'] },
        ],
      },
    ],
    'conventions/forbidden-directories': [
      'error',
      {
        patterns: [
          { name: 'tests', message: 'Put tests in __tests__/.' },
          { name: 'types', message: 'Put types in named files in models/.' },
          { name: '{lib,helpers}', message: 'Put the code in a role directory, such as utils/.' },
          {
            name: '{component,constant,container,context,hook,mapper,model,service,util}',
            message: 'Role directories have plural names, such as services/.',
          },
        ],
      },
    ],
    'conventions/forbidden-files': [
      'error',
      {
        patterns: [
          { name: 'types.ts', message: 'Put types in named files in models/.' },
          {
            name: '{utils,helpers}.ts',
            message: 'Split utils by entity, such as utils/UserUtil.ts.',
          },
          { name: 'index.tsx', message: 'Name the component file after the component.' },
          {
            name: 'src/{features,common}/*/!(index.ts)',
            message: 'Put the file in a role directory, such as components/ or utils/.',
          },
        ],
      },
    ],
    'conventions/root-only-files': ['error', { names: ['index.ts'] }],
    'conventions/directory-case': ['error', { case: 'kebab' }],
    'conventions/file-name-case': ['error', { case: ['camel', 'pascal'] }],
    'conventions/file-name-pattern': [
      'error',
      {
        includeTests: true,
        rules: [
          { directory: 'components', pattern: '[A-Z]*.tsx' },
          { directory: 'containers', pattern: '[A-Z]*Container{,.stories}.tsx' },
          { directory: 'contexts', pattern: '[A-Z]*Context.tsx' },
          { directory: 'hooks', pattern: 'use[A-Z]*.{ts,tsx}' },
          { directory: 'mappers', pattern: '[A-Z]*Mapper.ts' },
          { directory: 'models', pattern: '[A-Z]*.ts' },
          { directory: 'services', pattern: '[A-Z]*Service.ts' },
          { directory: 'utils', pattern: '[A-Z]*Util.ts' },
          { directory: '__tests__', pattern: '*.test.{ts,tsx}' },
          { directory: '**/containers/__tests__', pattern: '[A-Z]*Container.test.tsx' },
          { directory: '**/hooks/__tests__', pattern: 'use[A-Z]*.test.{ts,tsx}' },
          { directory: '**/mappers/__tests__', pattern: '[A-Z]*Mapper.test.ts' },
          { directory: '**/services/__tests__', pattern: '[A-Z]*Service.test.ts' },
          { directory: '**/utils/__tests__', pattern: '[A-Z]*Util.test.ts' },
        ],
      },
    ],
  },
  overrides: [
    {
      description: 'Named exports only, except in stories.',
      files: ['src/**'],
      ignore: ['**/*.stories.*'],
      rules: { 'conventions/no-default-export': 'error' },
    },
    {
      description: 'Each file exports a value named after the file, such as UserService.',
      files: ['src/**/{components,containers,contexts,hooks,mappers,services,utils}/*'],
      ignore: ['**/*.stories.*'],
      rules: { 'conventions/export-matches-filename': ['error', { transform: 'none' }] },
    },
  ],
});
```

## Read more

- [Presentational and Container Components](https://medium.com/@dan_abramov/smart-and-dumb-components-7ca2f9a7c7d0)
- [Functional Core, Imperative Shell](https://www.destroyallsoftware.com/screencasts/catalog/functional-core-imperative-shell)
