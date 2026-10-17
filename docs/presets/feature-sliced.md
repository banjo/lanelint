# Feature-Sliced Design

Checks the import rules of [Feature-Sliced Design](https://feature-sliced.design) (FSD), a
methodology for frontend projects.

```ts
import { featureSliced } from '@pilotlint/presets';

export default defineConfig({
  extends: [featureSliced()],
});
```

## Structure

```
src/
  app/          segments, such as routes/ and providers/
  pages/        slices, such as home/ and profile/
  widgets/      slices
  features/     slices
  entities/     slices
  shared/       segments, such as ui/, api/, and lib/
```

Each slice is an element of type `slice`. App and Shared are elements of type `layer`. The
deprecated `processes` layer is supported between App and Pages.

## Rules

- **Layers import only layers below them.** `features` may import `entities` and `shared`,
  never `widgets` or `pages`.
- **Slices on one layer do not import each other.** `features/like` must not import
  `features/comment`. Segments in App and Shared may import each other.
- **Slices are used through their public API.** Code outside a slice imports its `index.ts`,
  not the files inside it.
- **Code inside a slice uses relative imports,** not its own `index.ts`, which avoids cycles.
- **Entities cross-import through `@x`.** `entities/artist` may import
  `entities/song/@x/artist.ts`. Other layers may not import `@x` files.

## Options

| Option | Default | Description                                                                         |
| ------ | ------- | ----------------------------------------------------------------------------------- |
| `root` | `'src'` | The directory that holds the layers. It can have captures, such as `apps/:app/src`. |

In a monorepo where each app uses FSD:

```ts
extends: [monorepo(), featureSliced({ root: 'apps/:app/src' })],
```

## Limits

- Any entity may import another entity's `@x` files, not only the one the file is named
  after.
- [Slice groups](https://feature-sliced.design/docs/reference/slice-groups), such as
  `features/post/like`, are treated as one slice, so imports inside a group are not checked.

## Read more

- [Layers and the import rule](https://feature-sliced.design/docs/reference/layers)
- [Public API and `@x`](https://feature-sliced.design/docs/reference/public-api)
