# @pilotlint/presets

[![npm](https://img.shields.io/npm/v/@pilotlint/presets)](https://www.npmjs.com/package/@pilotlint/presets)

[pilotlint](https://github.com/banjo/pilotlint) presets for well-known architectures. Pick the
one your project follows, and pilotlint checks its import rules after every change.

## Install

```bash
npm install -D pilotlint @pilotlint/plugin-boundaries @pilotlint/presets
```

## Use

```ts
// pilotlint.config.ts
import boundaries from '@pilotlint/plugin-boundaries';
import { featureSliced } from '@pilotlint/presets';
import { defineConfig } from 'pilotlint';

export default defineConfig({
  extends: [boundaries.configs.recommended, featureSliced()],
});
```

## Presets

| Preset                                                                                                   | Checks                                                                                |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [`featureSliced()`](https://github.com/banjo/pilotlint/blob/main/docs/presets/feature-sliced.md)         | Feature-Sliced Design: layers import only lower layers, and slices use the public API |
| [`bulletproofReact()`](https://github.com/banjo/pilotlint/blob/main/docs/presets/bulletproof-react.md)   | Bulletproof React: shared code → features → app, and no imports between features      |
| [`monorepo()`](https://github.com/banjo/pilotlint/blob/main/docs/presets/monorepo.md)                    | Apps use packages through their entry, packages never use apps, no undeclared imports |
| [`cleanArchitecture()`](https://github.com/banjo/pilotlint/blob/main/docs/presets/clean-architecture.md) | Dependencies point inward, and the domain and application layers do no I/O            |
| [`layered()`](https://github.com/banjo/pilotlint/blob/main/docs/presets/layered.md)                      | Controllers → services → repositories, with no skipped or upward imports              |

Each preset takes options for your directories, for example
`cleanArchitecture({ root: 'src/modules/:module' })`. Presets can be combined:

```ts
extends: [monorepo(), featureSliced({ root: 'apps/:app/src' })],
```

See [how presets work](https://github.com/banjo/pilotlint/blob/main/docs/presets/README.md).

## License

MIT
