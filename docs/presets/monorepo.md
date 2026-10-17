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
  ui/           a package (element type package), entry src/index.ts or index.ts
  utils/
```

## Rules

- **Packages do not import apps.**
- **Apps do not import each other.**
- **Packages are used through their entry file.** `@acme/ui` is fine, `@acme/ui/src/button.ts`
  or a relative path into another package is not.
- **Imported packages are declared** in the nearest `package.json`, workspace packages too.
- **Apps and packages do not depend on each other in a cycle.**

## Options

| Option     | Default                                            | Description                                                         |
| ---------- | -------------------------------------------------- | ------------------------------------------------------------------- |
| `apps`     | `'apps/:name'`                                     | Directory patterns of apps. Use `[]` for a repository without apps. |
| `packages` | `'packages/:name'`                                 | Directory patterns of packages.                                     |
| `entry`    | `src/index.ts` or `index.ts`, any source extension | Entry files or globs of a package, relative to its root.            |

A package that exports subpaths, such as `@acme/ui/button`, lists them in `entry`:

```ts
monorepo({ entry: ['src/index.ts', 'src/button.ts'] });
```

To use another preset inside each app, add it after this one, for example
`featureSliced({ root: 'apps/:app/src' })`.

## Read more

- [Structuring a repository](https://turborepo.com/docs/crafting-your-repository/structuring-a-repository)
