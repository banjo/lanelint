# @pilotlint/plugin-changes

Rules about files that must or must not change together, based on git: `requires-change` and `no-manual-edit`.

```ts
import changes from '@pilotlint/plugin-changes';
import { defineConfig } from 'pilotlint';

export default defineConfig({
  plugins: [changes],
});
```

Run `pilotlint rules explain changes/<rule>` for the options and docs of each rule. See the
[repository README](../../README.md) for more.
