# Layered backend

Checks a classic layered backend, as in Express, Fastify, or NestJS: controllers call
services, services call repositories, and no layer imports a layer above it. Martin Fowler
describes the idea in
[Presentation Domain Data Layering](https://martinfowler.com/bliki/PresentationDomainDataLayering.html).

```ts
import { layered } from '@pilotlint/presets';

export default defineConfig({
  extends: [layered()],
});
```

## Structure

The layers are found by directory or by file name, so both styles work:

```
src/
  controllers/userController.ts      src/users/users.controller.ts
  services/userService.ts            src/users/users.service.ts
  repositories/userRepository.ts     src/users/users.repository.ts
```

Other files, such as models and DTOs, may be imported by every layer.

## Rules

- **Controllers do not use repositories.** They call a service.
- **Services do not import controllers.**
- **Repositories do not import services or controllers.**

## Options

| Option                | Default                                       | Description                |
| --------------------- | --------------------------------------------- | -------------------------- |
| `layers.controllers`  | `['**/controllers/**', '**/*.controller.*']`  | Globs of controller files. |
| `layers.services`     | `['**/services/**', '**/*.service.*']`        | Globs of service files.    |
| `layers.repositories` | `['**/repositories/**', '**/*.repository.*']` | Globs of repository files. |

```ts
layered({ layers: { controllers: ['src/handlers/**'] } });
```

## Read more

- [Presentation Domain Data Layering](https://martinfowler.com/bliki/PresentationDomainDataLayering.html)
