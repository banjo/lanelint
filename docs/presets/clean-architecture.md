# Clean Architecture

Checks the dependency rule of
[Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html):
source code dependencies point only inward, toward the business rules.

```ts
import { cleanArchitecture } from '@pilotlint/presets';

export default defineConfig({
  extends: [cleanArchitecture({ frameworks: ['express', '@prisma/client'] })],
});
```

## Structure

```
src/
  domain/          business entities and rules
  application/     use cases, and the interfaces they need
  infrastructure/  implementations of those interfaces: databases, APIs, files
  presentation/    controllers, handlers, and UI
  main.ts          wires the layers together
```

Each layer is an element of type `layer`. Files outside the layers, such as `main.ts`, may
import every layer.

## Rules

- **Domain imports no other layer.**
- **Application imports only domain.**
- **Infrastructure and presentation do not import each other.** Both use the application
  layer, and `main.ts` connects them.
- **Domain and application do no I/O.** They must not import Node builtins such as `node:fs`
  or `node:http`, or the packages in `frameworks`, and must not use globals such as `fetch`,
  `process`, `window`, or `localStorage`. Define an interface in the application layer and
  implement it in infrastructure.

## Options

| Option       | Default                                                   | Description                                                                               |
| ------------ | --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `root`       | `'src'`                                                   | The directory that holds the layers. It can have captures, such as `src/modules/:module`. |
| `layers`     | `domain`, `application`, `infrastructure`, `presentation` | Directory names of the layers, for example `{ domain: 'core', presentation: 'http' }`.    |
| `frameworks` | `[]`                                                      | Packages that only infrastructure and presentation may import.                            |

For a project split into modules, each with its own layers:

```ts
cleanArchitecture({ root: 'src/modules/:module' });
```

The preset sets `boundaries/restricted-packages` and `boundaries/restricted-globals`. If
your config sets them too, yours replace the preset's, so copy the restrictions you want to
keep.

## Read more

- [The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
