# Presets

Presets are ready-made configs for well-known architectures. Each one defines the elements
and the import rules of its architecture, so a config can start from one line. They are in
the `@lanelint/presets` package:

```bash
npm install -D lanelint @lanelint/plugin-boundaries @lanelint/presets
```

```ts
// lanelint.config.ts
import boundaries from '@lanelint/plugin-boundaries';
import { featureSliced } from '@lanelint/presets';
import { defineConfig } from 'lanelint';

export default defineConfig({
  extends: [boundaries.configs.recommended, featureSliced()],
});
```

| Preset                                         | For                                                          |
| ---------------------------------------------- | ------------------------------------------------------------ |
| [`featureSliced()`](feature-sliced.md)         | Frontends that follow Feature-Sliced Design                  |
| [`bulletproofReact()`](bulletproof-react.md)   | React apps with feature folders, as in Bulletproof React     |
| [`monorepo()`](monorepo.md)                    | Monorepos with apps and packages                             |
| [`cleanArchitecture()`](clean-architecture.md) | Backends with domain, application, and infrastructure layers |
| [`layered()`](layered.md)                      | Backends with controllers, services, and repositories        |
| [`astra()`](astra.md)                          | React apps with the same role directories in every feature   |

## How presets work

- A preset is a function that returns a config fragment for `extends`. Its options adapt it to
  your directories, for example `featureSliced({ root: 'app' })`.
- Presets check structure only. Add naming rules from `@lanelint/plugin-conventions` if you
  want them.
- Your own elements come before the preset's, so they win where both match. Presets can be
  combined, such as `[monorepo(), featureSliced({ root: 'apps/:app/src' })]`.
- Rules you set replace the preset's options for the same rule. Run `lanelint describe` to
  see what applies.
