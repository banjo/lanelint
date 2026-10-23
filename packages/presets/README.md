# @lanelint/presets

[![npm](https://img.shields.io/npm/v/@lanelint/presets)](https://www.npmjs.com/package/@lanelint/presets)

[lanelint](https://github.com/banjo/lanelint) presets for well-known architectures. Pick the
one your project follows, and lanelint checks its import rules after every change.

## Install

```bash
npm install -D lanelint @lanelint/plugin-boundaries @lanelint/presets
```

## Use

```ts
// lanelint.config.ts
import boundaries from '@lanelint/plugin-boundaries';
import { featureSliced } from '@lanelint/presets';
import { defineConfig } from 'lanelint';

export default defineConfig({
  extends: [boundaries.configs.recommended, featureSliced()],
});
```

## Presets

| Preset                                                                                                  | Checks                                                                                        |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [`featureSliced()`](https://github.com/banjo/lanelint/blob/main/docs/presets/feature-sliced.md)         | Feature-Sliced Design: layers import only lower layers, and slices use the public API         |
| [`bulletproofReact()`](https://github.com/banjo/lanelint/blob/main/docs/presets/bulletproof-react.md)   | Bulletproof React: shared code → features → app, and no imports between features              |
| [`monorepo()`](https://github.com/banjo/lanelint/blob/main/docs/presets/monorepo.md)                    | Packages are imported through what they export, never import apps, and are declared           |
| [`cleanArchitecture()`](https://github.com/banjo/lanelint/blob/main/docs/presets/clean-architecture.md) | Dependencies point inward, and the domain and application layers do no I/O                    |
| [`layered()`](https://github.com/banjo/lanelint/blob/main/docs/presets/layered.md)                      | Controllers → services → repositories, with no skipped or upward imports                      |
| [`astra()`](https://github.com/banjo/lanelint/blob/main/docs/presets/astra.md)                          | Feature layers: utils are pure, services do I/O, hooks call services, components only display |

Each preset takes options for your directories, for example
`cleanArchitecture({ root: 'src/modules/:module' })`. Presets can be combined:

```ts
extends: [monorepo(), featureSliced({ root: 'apps/:app/src' })],
```

See [how presets work](https://github.com/banjo/lanelint/blob/main/docs/presets/README.md).

## License

MIT
