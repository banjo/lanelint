# @pilotlint/core

The engine, project model, and rule API behind [pilotlint](../../README.md). See
[Writing rules](../../docs/writing-rules.md) for how to write and test rules.

Most projects install `pilotlint` instead, which re-exports `defineConfig`, `defineRule`, and
`definePlugin`. Plugin authors depend on `@pilotlint/core` as a peer dependency and test rules
with `@pilotlint/core/testing`:

```ts
import { describe, expect, it } from 'vitest';
import { testRule } from '@pilotlint/core/testing';
import { myRule } from '../src/myRule.ts';

testRule(
  'local/my-rule',
  myRule,
  {
    valid: [{ files: { 'src/a.ts': 'export const a = 1;' } }],
    invalid: [
      { files: { 'src/b.ts': 'export default 1;' }, findings: [{ path: 'src/b.ts', line: 1 }] },
    ],
  },
  { describe, it, expect },
);
```
