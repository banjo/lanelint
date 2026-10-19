# Monorepo

Checks a monorepo with deployable apps and shared packages, the layout that
[Turborepo](https://turborepo.com/docs/crafting-your-repository/structuring-a-repository)
and [pnpm workspaces](https://pnpm.io/workspaces) recommend.

```ts
import { monorepo } from '@pilotlint/presets';

export default defineConfig({
  extends: [monorepo()],
});
```

## Structure

```
apps/
  web/          an app (element type app)
  admin/
packages/
  ui/           a package (element type package)
  utils/
```

## Rules

- **Packages do not import apps.**
- **Apps do not import each other.**
- **Packages are imported by name, through what they export.** The public API of a package is
  `exports` in its `package.json`. If `@acme/ui` exports `.` and `./icons`, then `@acme/ui` and
  `@acme/ui/icons` are fine, while `@acme/ui/src/button.ts` and a relative path into
  `packages/ui` are not. A package without `exports` allows every subpath, as in Node.
  Imports between a package and packages nested inside it are not checked.
- **Imported packages are declared** in the nearest `package.json`, workspace packages too. Test
  and config files may also use dev tools declared in the root `package.json`.
- **Apps and packages do not depend on each other in a cycle.**

## Options

| Option     | Default            | Description                                                         |
| ---------- | ------------------ | ------------------------------------------------------------------- |
| `apps`     | `'apps/:name'`     | Directory patterns of apps. Use `[]` for a repository without apps. |
| `packages` | `'packages/:name'` | Directory patterns of packages.                                     |

Put nested patterns first, for example
`monorepo({ packages: ['packages/features/:name', 'packages/:name'] })`.

To use another preset inside each app, add it after this one, for example
`featureSliced({ root: 'apps/:app/src' })`.

## Read more

- [Structuring a repository](https://turborepo.com/docs/crafting-your-repository/structuring-a-repository)
