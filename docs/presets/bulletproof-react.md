# Bulletproof React

Checks the project structure from
[Bulletproof React](https://github.com/alan2207/bulletproof-react), a popular guide for
React applications: code flows one way, from shared code to features to the app.

```ts
import { bulletproofReact } from '@lanelint/presets';

export default defineConfig({
  extends: [bulletproofReact()],
});
```

## Structure

```
src/
  app/          routes, providers, and the router (element type app)
  features/     one directory per feature (element type feature)
  components/   shared code (element type shared)
  config/
  hooks/
  lib/
  stores/
  types/
  utils/
```

Other directories, such as `testing/` and `assets/`, are not checked: test helpers often
import the app on purpose, and assets have no code. Bulletproof React's own ESLint config also
leaves out `config/` and `stores/`, but they hold shared code, so this preset checks them.

## Rules

- **Features do not import each other.** Compose features in the app instead.
- **Features do not import the app.**
- **Shared code does not import features or the app.**

Bulletproof React advises against index files that re-export a whole feature, so features
are imported file by file. To require an index file anyway, add
`'boundaries/entry-only': ['error', { elements: 'feature' }]`.

## Options

| Option   | Default                                                                | Description                                                    |
| -------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| `root`   | `'src'`                                                                | The directory that holds `app/`, `features/`, and shared code. |
| `shared` | `['components', 'config', 'hooks', 'lib', 'stores', 'types', 'utils']` | Directories of shared code.                                    |

## Read more

- [Project structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md)
