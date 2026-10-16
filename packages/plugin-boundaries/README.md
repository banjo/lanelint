# @pilotlint/plugin-boundaries

Rules about dependencies between elements and on packages: `allowed-imports`, `entry-only`, `no-entry-import`, `public-api`, `no-cycles`, `no-unresolved`, `restricted-packages`, `restricted-globals`, `no-undeclared-dependency`, and `no-orphans`.

```ts
import boundaries from '@pilotlint/plugin-boundaries';
import { defineConfig } from 'pilotlint';

export default defineConfig({
  plugins: [boundaries],
});
```

Run `pilotlint rules explain boundaries/<rule>` for the options and docs of each rule. See the
[repository README](../../README.md) for more.
