# @pilotlint/plugin-changes

Rules about files that must or must not change together, compared with a git ref.

```ts
import changes from '@pilotlint/plugin-changes';
import { defineConfig } from 'pilotlint';

export default defineConfig({
  plugins: [changes],
});
```

See the [rules and their options](../../docs/rules/changes.md), or run
`pilotlint rules explain changes/<rule>`.
