# @pilotlint/plugin-conventions

Rules about file and directory names, placement, required files, exports, and suppression comments.

```ts
import conventions from '@pilotlint/plugin-conventions';
import { defineConfig } from 'pilotlint';

export default defineConfig({
  plugins: [conventions],
});
```

See the [rules and their options](../../docs/rules/conventions.md), or run
`pilotlint rules explain conventions/<rule>`.
