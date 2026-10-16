# @pilotlint/plugin-boundaries

Rules about imports between elements, packages, and globals.

```ts
import boundaries from '@pilotlint/plugin-boundaries';
import { defineConfig } from 'pilotlint';

export default defineConfig({
  plugins: [boundaries],
});
```

See the [rules and their options](../../docs/rules/boundaries.md), or run
`pilotlint rules explain boundaries/<rule>`.
